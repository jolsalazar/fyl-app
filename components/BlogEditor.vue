<template>
  <div class="editor-wrap">
    <div v-if="editor" class="toolbar">
      <button type="button" :class="{ on: editor.isActive('heading', { level: 2 }) }" title="Título de sección"
              @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">H2</button>
      <button type="button" :class="{ on: editor.isActive('heading', { level: 3 }) }" title="Subtítulo"
              @click="editor.chain().focus().toggleHeading({ level: 3 }).run()">H3</button>

      <span class="sep"></span>

      <button type="button" :class="{ on: editor.isActive('bold') }" title="Negrita"
              @click="editor.chain().focus().toggleBold().run()"><b>B</b></button>
      <button type="button" :class="{ on: editor.isActive('italic') }" title="Cursiva"
              @click="editor.chain().focus().toggleItalic().run()"><i>I</i></button>

      <span class="sep"></span>

      <button type="button" :class="{ on: editor.isActive('bulletList') }" title="Lista con viñetas"
              @click="editor.chain().focus().toggleBulletList().run()">• Lista</button>
      <button type="button" :class="{ on: editor.isActive('orderedList') }" title="Lista numerada"
              @click="editor.chain().focus().toggleOrderedList().run()">1. Lista</button>
      <button type="button" :class="{ on: editor.isActive('blockquote') }" title="Cita destacada"
              @click="editor.chain().focus().toggleBlockquote().run()">❝ Cita</button>

      <span class="sep"></span>

      <button type="button" :class="{ on: editor.isActive('link') }" title="Enlace"
              @click="editarEnlace">🔗 Enlace</button>
      <button type="button" :disabled="!editor.isActive('link')" title="Quitar enlace"
              @click="editor.chain().focus().unsetLink().run()">⛓️‍💥</button>

      <span class="sep"></span>

      <button type="button" title="Tabla"
              @click="editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()">▦ Tabla</button>
      <button type="button" title="Separador"
              @click="editor.chain().focus().setHorizontalRule().run()">— Línea</button>
      <button type="button" :disabled="subiendo" title="Insertar imagen en el cuerpo"
              @click="fileInput?.click()">{{ subiendo ? '…' : '🖼️ Imagen' }}</button>

      <span class="grow"></span>

      <button type="button" title="Deshacer" @click="editor.chain().focus().undo().run()">↶</button>
      <button type="button" title="Rehacer" @click="editor.chain().focus().redo().run()">↷</button>
    </div>

    <div v-if="editor?.isActive('table')" class="toolbar toolbar-sub">
      <button type="button" @click="editor.chain().focus().addColumnAfter().run()">+ Columna</button>
      <button type="button" @click="editor.chain().focus().addRowAfter().run()">+ Fila</button>
      <button type="button" @click="editor.chain().focus().deleteColumn().run()">− Columna</button>
      <button type="button" @click="editor.chain().focus().deleteRow().run()">− Fila</button>
      <button type="button" class="danger" @click="editor.chain().focus().deleteTable().run()">Borrar tabla</button>
    </div>

    <EditorContent :editor="editor" class="editor prose" />

    <input ref="fileInput" type="file" accept="image/*" hidden @change="insertarImagen" />
  </div>
</template>

<script setup lang="ts">
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'

const props = defineProps<{
  modelValue: string
  /** Slug del post: define el nombre de las imágenes que se suban al cuerpo. */
  slug?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const { show } = useToast()
const { subirImagenCuerpo } = useBlogImages()

const editor    = shallowRef<Editor>()
const fileInput = ref<HTMLInputElement>()
const subiendo  = ref(false)

/**
 * Convención del sitio público (ver CLAUDE.md de ../fyl): los enlaces externos
 * abren en pestaña nueva con rel de seguridad; los internos se quedan en la
 * misma pestaña. Tiptap no distingue por href, así que normalizamos el HTML al
 * emitirlo en vez de pelear con la extensión.
 */
function normalizarEnlaces (html: string): string {
  if (typeof window === 'undefined') return html
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')

  for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
    const href = a.getAttribute('href') ?? ''
    const externo = /^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?fondosylicitaciones\.cl/i.test(href)

    if (externo) {
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
    } else {
      a.removeAttribute('target')
      a.removeAttribute('rel')
    }
  }

  return doc.body.firstElementChild?.innerHTML ?? html
}

function editarEnlace () {
  if (!editor.value) return
  const actual = editor.value.getAttributes('link').href ?? ''
  const url = window.prompt('URL del enlace (interno: /fondos-corfo/ · externo: https://…)', actual)
  if (url === null) return
  if (url === '') {
    editor.value.chain().focus().unsetLink().run()
    return
  }
  editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

async function insertarImagen (e: Event) {
  const input = e.target as HTMLInputElement
  const file  = input.files?.[0]
  input.value = ''
  if (!file || !editor.value) return

  subiendo.value = true
  try {
    const url = await subirImagenCuerpo(file, props.slug ?? '')
    editor.value.chain().focus().setImage({ src: url }).run()
  } catch (err: any) {
    show(err?.message ?? 'No se pudo subir la imagen', 'error')
  } finally {
    subiendo.value = false
  }
}

onMounted(() => {
  editor.value = new Editor({
    content: props.modelValue,
    extensions: [
      StarterKit.configure({
        // El sitio pinta el <h1> desde el título del post: en el cuerpo solo
        // deben existir h2/h3, igual que en los .md originales.
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: { openOnClick: false, autolink: false },
      }),
      Image.configure({ inline: false }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    onUpdate: ({ editor }) => {
      emit('update:modelValue', normalizarEnlaces(editor.getHTML()))
    },
  })
})

// Solo re-sincronizamos si el cambio viene de fuera (p. ej. al cargar el post),
// no en cada tecleo: eso reventaría el cursor.
watch(() => props.modelValue, (valor) => {
  if (!editor.value) return
  if (normalizarEnlaces(editor.value.getHTML()) === valor) return
  editor.value.commands.setContent(valor, { emitUpdate: false })
})

onBeforeUnmount(() => editor.value?.destroy())
</script>

<!-- Sin scope: las reglas de .prose deben alcanzar el HTML que genera
     ProseMirror, y son las mismas que usa el sitio público. -->
<style>
@import '~/assets/css/prose.css';
</style>

<style scoped>
.editor-wrap { border: 1.5px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #fff; }

.toolbar {
  display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
  padding: 8px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
  position: sticky; top: 0; z-index: 5;
}
.toolbar-sub { background: #eef2ff; border-bottom-color: #c7d2fe; }
.toolbar button {
  border: 1px solid transparent; background: transparent; color: #0f172a;
  padding: 5px 9px; border-radius: 7px; font-size: 0.82rem; font-weight: 600;
  cursor: pointer; font-family: inherit; line-height: 1.2;
}
.toolbar button:hover:not(:disabled) { background: #e2e8f0; }
.toolbar button.on { background: #0ea5e9; color: #fff; }
.toolbar button:disabled { opacity: 0.35; cursor: not-allowed; }
.toolbar button.danger { color: #dc2626; }
.sep  { width: 1px; height: 20px; background: #e2e8f0; margin: 0 4px; }
.grow { flex: 1; }

.editor { padding: 20px 24px; min-height: 420px; max-height: 70vh; overflow-y: auto; }
.editor :deep(.ProseMirror) { outline: none; min-height: 380px; }
.editor :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: 'Escribe el artículo…'; color: #94a3b8; float: left; height: 0; pointer-events: none;
}

/* Ayudas visuales que solo existen mientras editas. */
.editor :deep(table) { table-layout: fixed; }
.editor :deep(td), .editor :deep(th) { border: 1px solid #cbd5e1; position: relative; }
.editor :deep(.selectedCell::after) {
  content: ''; position: absolute; inset: 0; background: rgba(14,165,233,0.12); pointer-events: none;
}
.editor :deep(a) { color: #0284c7; text-decoration: underline; }
.editor :deep(img.ProseMirror-selectednode) { outline: 3px solid #0ea5e9; }
</style>
