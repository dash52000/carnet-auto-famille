// Lecture du texte d'un papier, entièrement dans le téléphone (gratuit, sans clé, rien n'est envoyé) :
// - photo → OCR Tesseract.js (comme ML Kit dans l'appli Zytho) ;
// - PDF (attestation ou facture reçue par mail) → texte du PDF avec pdf.js, ou OCR de la 1re page si c'est un scan.
// Les deux moteurs ne sont chargés qu'au premier usage, puis restent en cache.

/** Photo redimensionnée, en niveaux de gris et contrastée : l'OCR lit mieux. */
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

async function ocr(image, onProgres) {
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
  return ocr(canvas, onProgres)
}

/** Texte brut d'une photo ou d'un PDF. onProgres(0..1) suit l'avancement. */
export async function lireTexte(fichier, onProgres = () => {}) {
  const pdf = fichier.type === 'application/pdf' || /\.pdf$/i.test(fichier.name)
  return pdf ? lirePdf(fichier, onProgres) : ocr(await preparer(fichier), onProgres)
}
