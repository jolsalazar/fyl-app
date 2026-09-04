/**
 * Subida de imágenes del blog al bucket 'blog' de Supabase Storage.
 *
 * El redimensionado ocurre EN EL NAVEGADOR con <canvas>, no en el servidor:
 * Nitro corre sobre Cloudflare Workers y ahí no hay sharp ni nada equivalente.
 * De cada archivo salen dos derivados WebP:
 *
 *   - hero  ~1200px de ancho → se usa como imagen destacada y og:image
 *   - thumb  ~480px de ancho → se usa en las tarjetas del listado
 *
 * El sitio público espera hero en proporción 3:2 (declara width=1200
 * height=800), así que recortamos a 3:2 antes de escalar.
 */

const BUCKET      = 'blog'
const HERO_WIDTH  = 1200
const THUMB_WIDTH = 480
const RATIO       = 3 / 2
const QUALITY     = 0.85
const MAX_BYTES   = 12 * 1024 * 1024 // 12MB de entrada; los derivados pesan mucho menos

export function useBlogImages () {
  const supabase = useSupabaseClient()

  function cargarImagen (file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload  = () => { URL.revokeObjectURL(url); resolve(img) }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('no se pudo leer la imagen')) }
      img.src = url
    })
  }

  /** Recorta al centro en 3:2 y escala al ancho pedido. Devuelve WebP. */
  function derivar (img: HTMLImageElement, width: number): Promise<Blob> {
    const height = Math.round(width / RATIO)

    // Recorte centrado: nos quedamos con la mayor región 3:2 que quepa.
    let sw = img.naturalWidth
    let sh = Math.round(sw / RATIO)
    if (sh > img.naturalHeight) {
      sh = img.naturalHeight
      sw = Math.round(sh * RATIO)
    }
    const sx = Math.round((img.naturalWidth  - sw) / 2)
    const sy = Math.round((img.naturalHeight - sh) / 2)

    const canvas = document.createElement('canvas')
    canvas.width  = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return Promise.reject(new Error('canvas no disponible'))
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('no se pudo generar la imagen'))
          // Navegadores sin soporte WebP caen a PNG: lo detectamos para no
          // subir un .webp que en realidad es otra cosa.
          if (blob.type !== 'image/webp') {
            return reject(new Error('tu navegador no puede generar WebP; usa Chrome, Edge o Firefox actualizado'))
          }
          resolve(blob)
        },
        'image/webp',
        QUALITY,
      )
    })
  }

  async function subir (path: string, blob: Blob): Promise<string> {
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: 'image/webp',
      upsert: true,        // reemplaza al re-subir la imagen de un mismo post
      cacheControl: '31536000',
    })
    if (error) throw new Error(error.message)

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    // Cache-buster: el nombre del archivo depende del slug, así que sin esto
    // una imagen reemplazada seguiría mostrándose vieja en el CDN.
    return `${data.publicUrl}?v=${Date.now()}`
  }

  /**
   * Procesa y sube un archivo. Devuelve las URLs públicas de ambos derivados.
   * El slug define los nombres, así que re-subir sobre el mismo post pisa los
   * archivos anteriores en vez de acumular basura en el bucket.
   */
  async function subirHero (file: File, slug: string): Promise<{ hero: string; thumb: string }> {
    if (!file.type.startsWith('image/')) throw new Error('el archivo no es una imagen')
    if (file.size > MAX_BYTES)           throw new Error('la imagen supera los 12MB')
    if (!slug)                           throw new Error('define primero el slug del post')

    const img = await cargarImagen(file)
    const [heroBlob, thumbBlob] = await Promise.all([
      derivar(img, HERO_WIDTH),
      derivar(img, THUMB_WIDTH),
    ])

    const [hero, thumb] = await Promise.all([
      subir(`${slug}.webp`,       heroBlob),
      subir(`${slug}-thumb.webp`, thumbBlob),
    ])

    return { hero, thumb }
  }

  /** Sube una imagen suelta para insertar dentro del cuerpo del post. */
  async function subirImagenCuerpo (file: File, slug: string): Promise<string> {
    if (!file.type.startsWith('image/')) throw new Error('el archivo no es una imagen')
    if (file.size > MAX_BYTES)           throw new Error('la imagen supera los 12MB')

    const img  = await cargarImagen(file)
    const blob = await derivar(img, HERO_WIDTH)
    const name = `${slug || 'suelta'}-${Math.random().toString(36).slice(2, 8)}.webp`
    return subir(`cuerpo/${name}`, blob)
  }

  return { subirHero, subirImagenCuerpo }
}
