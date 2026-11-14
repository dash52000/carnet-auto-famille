import { supabase, BUCKET } from './supabase.js'

/** Réduit une photo (max 1600 px, JPEG) pour économiser le stockage gratuit. Les PDF passent tels quels. */
export async function compresser(fichier) {
  if (!fichier.type.startsWith('image/')) return fichier
  try {
    const bitmap = await createImageBitmap(fichier)
    const max = 1600
    const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * ratio)
    canvas.height = Math.round(bitmap.height * ratio)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.75))
    if (!blob) return fichier
    return new File([blob], fichier.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return fichier // format non lisible par le navigateur : on envoie l'original
  }
}

/** Envoie un fichier dans le dossier de la voiture et renvoie son chemin. */
export async function envoyerFichier(vehiculeId, fichier) {
  const f = await compresser(fichier)
  const ext = f.name.split('.').pop()?.toLowerCase() || 'bin'
  const chemin = `${vehiculeId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(chemin, f, { contentType: f.type })
  if (error) throw new Error(error.message)
  return chemin
}

/** Lien temporaire (1 h) vers un fichier privé. */
export async function lienFichier(chemin) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, 3600)
  if (error) throw new Error(error.message)
  return data.signedUrl
}
