// Lecture du texte d'un papier, entièrement dans le téléphone (gratuit, sans clé, rien n'est envoyé) :
// - photo → PaddleOCR (réseau de neurones PP-OCRv5, modèle latin, via ONNX Runtime Web),
//   avec repli automatique sur Tesseract.js si PaddleOCR ne se charge pas ou ne lit rien ;
// - PDF (attestation ou facture reçue par mail) → texte du PDF avec pdf.js, ou OCR de la 1re page si c'est un scan.
// Les moteurs ne sont chargés qu'au premier usage ; les modèles PaddleOCR sont gardés dans le cache du navigateur.

const CACHE_MODELES = 'ocr-modeles-v1'

/** Télécharge un fichier de modèle une seule fois, puis le relit depuis le cache du navigateur. */
async function telecharger(url) {
  const cache = await globalThis.caches?.open(CACHE_MODELES).catch(() => null)
  let reponse = cache ? await cache.match(url) : null
  if (!reponse) {
    reponse = await fetch(url)
    if (!reponse.ok) throw new Error(`Modèle indisponible (${reponse.status})`)
    if (cache) await cache.put(url, reponse.clone()).catch(() => {})
  }
  return reponse.arrayBuffer()
}

let servicePaddle = null // gardé entre deux lectures pendant la session

async function paddle(onProgres) {
  if (!servicePaddle) {
    servicePaddle = (async () => {
      const { PaddleOcrService, V5_LATIN_MOBILE_MODEL: m } = await import('ppu-paddle-ocr/web')
      onProgres(0.05)
      const [detection, recognition, charactersDictionary] = await Promise.all([
        telecharger(m.detection).then((b) => (onProgres(0.25), b)),
        telecharger(m.recognition).then((b) => (onProgres(0.35), b)),
        telecharger(m.charactersDictionary),
      ])
      const service = new PaddleOcrService({
        model: { detection, recognition, charactersDictionary },
        recognition: { spaceRecovery: true },
      })
      await service.initialize()
      return service
    })()
    servicePaddle.catch(() => (servicePaddle = null)) // on retentera à la prochaine lecture
  }
  return servicePaddle
}

/** PaddleOCR, avec une progression approximative (le moteur ne la donne pas). */
async function lirePaddle(image, onProgres) {
  const service = await paddle(onProgres)
  onProgres(0.45)
  let p = 0.45
  const minuteur = setInterval(() => onProgres((p = Math.min(0.95, p + 0.05))), 400)
  try {
    const { text } = await service.recognize(image)
    return text
  } finally {
    clearInterval(minuteur)
  }
}

/** Photo redimensionnée pour limiter la mémoire (les grosses photos de téléphone font 12 Mpx). */
async function redimensionner(fichier, max = 2000) {
  const bitmap = await createImageBitmap(fichier)
  const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * ratio)
  canvas.height = Math.round(bitmap.height * ratio)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas
}

/** Pour Tesseract : photo en niveaux de gris et contrastée, il lit mieux. */
async function preparer(fichier) {
  try {
    const bitmap = await createImageBitmap(fichier)
    const ratio = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * ratio)
    canvas.height = Math.round(bitmap.height * ratio)
    const ctx = canvas.getContext('2d')
    ctx.filter = 'grayscale(1) contrast(1.4)'
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas
  } catch {
    return fichier
  }
}

async function tesseract(image, onProgres) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('fra', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgres(0.2 + 0.8 * m.progress)
      else if (typeof m.progress === 'number') onProgres(0.2 * m.progress)
    },
  })
  try {
    const { data } = await worker.recognize(image)
    return data.text
  } finally {
    await worker.terminate()
  }
}

async function chargerPdfjs() {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.min.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs
}

async function lirePdf(fichier, onProgres) {
  const pdfjs = await chargerPdfjs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await fichier.arrayBuffer()) }).promise
  const pages = []
  for (let p = 1; p <= Math.min(doc.numPages, 3); p++) {
    const { items } = await (await doc.getPage(p)).getTextContent()
    // on reconstitue les lignes : morceaux de même hauteur, triés de gauche à droite
    const lignes = new Map()
    for (const it of items) {
      if (!it.str?.trim()) continue
      const y = Math.round(it.transform[5] / 3)
      if (!lignes.has(y)) lignes.set(y, [])
      lignes.get(y).push(it)
    }
    pages.push(
      [...lignes.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, morceaux]) => morceaux.sort((a, b) => a.transform[4] - b.transform[4]).map((m) => m.str).join(' '))
        .join('\n'),
    )
    onProgres((0.5 * p) / Math.min(doc.numPages, 3))
  }
  const texte = pages.join('\n')
  if (texte.replace(/\s/g, '').length > 40) return texte

  // PDF scanné (une image sans texte) : on dessine la 1re page et on la passe à l'OCR
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 2.5 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
  return ocrImage(() => canvas, () => canvas, onProgres)
}

/** PaddleOCR d'abord ; Tesseract si Paddle échoue (vieux téléphone, réseau) ou ne trouve presque rien. */
async function ocrImage(imagePaddle, imageTesseract, onProgres) {
  try {
    const texte = await lirePaddle(await imagePaddle(), onProgres)
    if (texte && texte.replace(/\s/g, '').length >= 15) return texte
  } catch (e) {
    console.warn('PaddleOCR indisponible, repli sur Tesseract', e)
  }
  onProgres(0)
  return tesseract(await imageTesseract(), onProgres)
}

/** Texte brut d'une photo ou d'un PDF. onProgres(0..1) suit l'avancement. */
export async function lireTexte(fichier, onProgres = () => {}) {
  const pdf = fichier.type === 'application/pdf' || /\.pdf$/i.test(fichier.name)
  if (pdf) return lirePdf(fichier, onProgres)
  return ocrImage(
    () => redimensionner(fichier),
    () => preparer(fichier),
    onProgres,
  )
}
