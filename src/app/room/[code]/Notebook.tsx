'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useGesture } from '@/lib/useGesture'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'

type Project = { id: string; name: string; created_at: string }

// ── Page constants ───────────────────────────────────────
const LINES_PER_PAGE = 12
const LINE_HEIGHT    = 32
const PAD_TOP        = 13   // aligns text baseline to ruled lines
const PAD_BOTTOM     = 32
const PAGE_HEIGHT    = LINES_PER_PAGE * LINE_HEIGHT + PAD_TOP + PAD_BOTTOM  // 429px

// ── Toolbar button ───────────────────────────────────────
function ToolBtn({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      style={{
        padding: '3px 7px', borderRadius: 4, border: 'none', cursor: 'pointer',
        fontWeight: 'bold', fontSize: 13, fontFamily: 'sans-serif',
        background: active ? '#c9935a' : 'rgba(139,90,43,0.12)',
        color: active ? '#fff' : '#5a3010',
        transition: 'background 0.12s',
      }}
    >{children}</button>
  )
}

// ── Toolbar ──────────────────────────────────────────────
function Toolbar({ editor, onImage }: { editor: any; onImage: () => void }) {
  const [, rerender] = useState(0)
  useEffect(() => {
    if (!editor) return
    const fn = () => rerender(n => n + 1)
    editor.on('transaction', fn)
    return () => { editor.off('transaction', fn) }
  }, [editor])
  if (!editor) return null

  function insertDate() {
    const now = new Date()
    const str = now.toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    editor.chain().focus().insertContent(`📅 ${str}\n`).run()
  }

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 4, padding: '7px 20px 7px 76px',
      borderBottom: '1.5px solid #c8d8ea', background: '#f0ebe0',
      alignItems: 'center', flexShrink: 0,
    }}>
      <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()}       active={editor.isActive('bold')}    title="Negrita">B</ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()}     active={editor.isActive('italic')}  title="Cursiva"><em>I</em></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()}  active={editor.isActive('underline')} title="Subrayado"><u>U</u></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()}     active={editor.isActive('strike')}  title="Tachado"><s>S</s></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHighlight().run()}  active={editor.isActive('highlight')} title="Resaltar">🖍</ToolBtn>
      <div style={{ width: 1, height: 20, background: '#c8b890', margin: '0 2px' }} />
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="H1">H1</ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2">H2</ToolBtn>
      <div style={{ width: 1, height: 20, background: '#c8b890', margin: '0 2px' }} />
      <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()}  active={editor.isActive('bulletList')}  title="Lista">• Lista</ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numerada">1. Lista</ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()}    active={editor.isActive('taskList')}    title="Tareas">✅ Tareas</ToolBtn>
      <div style={{ width: 1, height: 20, background: '#c8b890', margin: '0 2px' }} />
      <ToolBtn onClick={insertDate} title="Fecha">📅 Fecha</ToolBtn>
      <ToolBtn onClick={onImage}    title="Imagen">🖼 Imagen</ToolBtn>
    </div>
  )
}

// ── Main component ───────────────────────────────────────
export default function Notebook({ roomCode, userId }: { roomCode: string; userId: string }) {
  const [projects,       setProjects]       = useState<Project[]>([])
  const [selected,       setSelected]       = useState<Project | null>(null)
  const [noteId,         setNoteId]         = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [saving,         setSaving]         = useState(false)
  const saveTimeout  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRemote     = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Multi-page state ──────────────────────────────────
  const [pages,     setPages]     = useState<object[]>([{}])
  const [pageIndex, setPageIndex] = useState(0)
  const [pageFull,  setPageFull]  = useState(false)

  // 3D page-turn animation
  const [slideDir,    setSlideDir]    = useState<'left' | 'right'>('left')
  const [showExit,    setShowExit]    = useState(false)   // exit div visible
  const [showEnter,   setShowEnter]   = useState(false)   // enter anim on editor
  const [exitHtml,    setExitHtml]    = useState('')       // snapshot of old page
  const transitioning = useRef(false)

  // refs for stable gesture closures
  const pageIndexRef  = useRef(0)
  const pagesRef      = useRef<object[]>([{}])
  const editorRef     = useRef<ReturnType<typeof useEditor>>(null)
  useEffect(() => { pageIndexRef.current = pageIndex }, [pageIndex])
  useEffect(() => { pagesRef.current     = pages     }, [pages])

  // project list ref
  const projectsRef   = useRef<typeof projects>(projects)
  const selectedRef   = useRef<typeof selected>(selected)
  useEffect(() => { projectsRef.current = projects }, [projects])
  useEffect(() => { selectedRef.current = selected }, [selected])

  // ── Editor ────────────────────────────────────────────
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder: 'Empezá a escribir acá...' }),
    ],
    content: '',
    editorProps: {
      attributes: {
        style: [
          'outline:none',
          `min-height:${PAGE_HEIGHT - PAD_TOP - PAD_BOTTOM}px`,
          `padding:${PAD_TOP}px 28px ${PAD_BOTTOM}px 76px`,
          'font-size:15px',
          'line-height:32px',
          'color:#1a1408',
          'font-family:Georgia,serif',
        ].join(';'),
      },
    },
    onUpdate: ({ editor }) => {
      if (isRemote.current) return
      // Check if page is full
      const prose = editor.view.dom as HTMLElement
      setPageFull(prose.scrollHeight > PAGE_HEIGHT)
      // Save + broadcast
      const json = editor.getJSON()
      const updatedPages = [...pagesRef.current]
      updatedPages[pageIndexRef.current] = json
      pagesRef.current = updatedPages
      setPages(updatedPages)
      saveNote(updatedPages)
      broadcastNote(updatedPages, pageIndexRef.current)
    },
  })

  useEffect(() => { editorRef.current = editor }, [editor])

  // Block editor input when page is full
  useEffect(() => {
    if (!editor) return
    editor.setEditable(!pageFull)
  }, [editor, pageFull])

  // ── Save ──────────────────────────────────────────────
  const saveNote = useCallback((pagesData: object[]) => {
    setSaving(true)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      if (!noteId) return
      await supabase.from('notes')
        .update({ content: JSON.stringify({ pages: pagesData }), updated_at: new Date().toISOString() })
        .eq('id', noteId)
      setSaving(false)
    }, 800)
  }, [noteId])

  const broadcastNote = useCallback((pagesData: object[], activeIdx: number) => {
    supabase.channel(`notebook:${roomCode}`).send({
      type: 'broadcast', event: 'note-updated',
      payload: { project_id: selectedRef.current?.id, pages: pagesData, activeIdx },
    })
  }, [roomCode])

  // ── Realtime ──────────────────────────────────────────
  useEffect(() => {
    loadProjects()
    const ch = supabase.channel(`notebook:${roomCode}`)
      .on('broadcast', { event: 'project-created' }, () => loadProjects())
      .on('broadcast', { event: 'note-updated' }, ({ payload }) => {
        if (!editor || !selectedRef.current || payload.project_id !== selectedRef.current.id) return
        isRemote.current = true
        if (payload.pages) {
          pagesRef.current = payload.pages
          setPages(payload.pages)
          if (payload.activeIdx === pageIndexRef.current) {
            try { editor.commands.setContent(payload.pages[payload.activeIdx] || {}) }
            catch { /* ignore */ }
          }
        }
        isRemote.current = false
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [roomCode, editor])

  useEffect(() => {
    if (selected) loadNote(selected.id)
  }, [selected])

  // ── Data ──────────────────────────────────────────────
  async function loadProjects() {
    const { data } = await supabase.from('projects').select('*')
      .eq('room_code', roomCode).order('created_at', { ascending: true })
    if (data) setProjects(data)
  }

  async function loadNote(projectId: string) {
    if (!editor) return
    setPageIndex(0)
    pageIndexRef.current = 0
    setPageFull(false)

    const { data } = await supabase.from('notes').select('*')
      .eq('project_id', projectId).single()

    let pagesData: object[] = [{}]
    if (data) {
      setNoteId(data.id)
      try {
        const parsed = JSON.parse(data.content || '{}')
        if (parsed.pages && Array.isArray(parsed.pages)) {
          pagesData = parsed.pages
        } else if (parsed.type === 'doc') {
          pagesData = [parsed] // legacy single-page
        }
      } catch { /* empty */ }
    } else {
      const { data: n } = await supabase.from('notes')
        .insert({ project_id: projectId, content: JSON.stringify({ pages: [{}] }) })
        .select().single()
      if (n) setNoteId(n.id)
    }

    pagesRef.current = pagesData
    setPages(pagesData)
    isRemote.current = true
    try { editor.commands.setContent(pagesData[0] || {}) }
    catch { editor.commands.clearContent() }
    isRemote.current = false
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault()
    if (!newProjectName.trim()) return
    const { data } = await supabase.from('projects')
      .insert({ name: newProjectName.trim(), room_code: roomCode, created_by: userId })
      .select().single()
    if (data) {
      setNewProjectName('')
      await loadProjects()
      setSelected(data)
      supabase.channel(`notebook:${roomCode}`).send({
        type: 'broadcast', event: 'project-created', payload: {},
      })
    }
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !editor) return
    const reader = new FileReader()
    reader.onload = () => {
      editor.chain().focus().setImage({ src: reader.result as string }).run()
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── Page navigation (3D flip) ─────────────────────────
  const goToPage = useCallback((n: number) => {
    if (transitioning.current) return
    const allPages = pagesRef.current
    if (n < 0 || n >= allPages.length) return
    if (n === pageIndexRef.current) return

    const dir = n > pageIndexRef.current ? 'left' : 'right'
    transitioning.current = true
    setSlideDir(dir)

    // Snapshot current page HTML for the exit animation
    const prose = editorRef.current?.view.dom as HTMLElement | null
    setExitHtml(prose?.innerHTML ?? '')
    setShowExit(true)
    setShowEnter(false)

    // After exit animation → swap content → enter animation
    setTimeout(() => {
      isRemote.current = true
      try { editorRef.current?.commands.setContent(allPages[n] || {}) }
      catch { editorRef.current?.commands.clearContent() }
      isRemote.current = false
      setPageIndex(n)
      pageIndexRef.current = n
      setPageFull(false)
      setShowExit(false)
      setShowEnter(true)

      setTimeout(() => {
        setShowEnter(false)
        transitioning.current = false
      }, 400)
    }, 300)
  }, [])

  function addPage() {
    const allPages = [...pagesRef.current]
    // Save current page
    allPages[pageIndexRef.current] = editorRef.current?.getJSON() ?? {}
    const newIdx = pageIndexRef.current + 1
    allPages.splice(newIdx, 0, {}) // insert empty page after current
    pagesRef.current = allPages
    setPages(allPages)
    saveNote(allPages)
    goToPage(newIdx)
  }

  // Project navigation (header arrows)
  function navigateProject(dir: 'left' | 'right') {
    if (transitioning.current) return
    const list = projectsRef.current
    if (!list.length) return
    const sel = selectedRef.current
    const idx = sel ? list.findIndex(p => p.id === sel.id) : -1
    const next = dir === 'right'
      ? list[(idx + 1) % list.length]
      : list[(idx - 1 + list.length) % list.length]
    if (!next || next.id === sel?.id) return
    setSelected(next)
  }

  // ── Gestures: swipe navigates pages ──────────────────
  useGesture(useCallback((e) => {
    if (e.gesture === 'swipe_left')  goToPage(pageIndexRef.current + 1)
    if (e.gesture === 'swipe_right') goToPage(pageIndexRef.current - 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goToPage]), ['swipe_left', 'swipe_right'])

  // ── Render ────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden" style={{ fontFamily: 'Georgia, serif' }}>

      <style>{`
        .tiptap-notebook h1 { font-size:22px; font-weight:bold; color:#2d1e0a; margin:0; line-height:32px }
        .tiptap-notebook h2 { font-size:17px; font-weight:bold; color:#3d2a10; margin:0; line-height:32px }
        .tiptap-notebook p  { margin:0; line-height:32px }
        .tiptap-notebook ul { padding-left:24px; margin:0 }
        .tiptap-notebook ol { padding-left:24px; margin:0 }
        .tiptap-notebook li { line-height:32px }
        .tiptap-notebook mark { background:#fde047; border-radius:2px; padding:0 2px }
        .tiptap-notebook img { max-width:100%; border-radius:6px; margin:4px 0 }
        .tiptap-notebook ul[data-type="taskList"] { list-style:none; padding-left:4px }
        .tiptap-notebook ul[data-type="taskList"] li { display:flex; align-items:flex-start; gap:8px; line-height:32px }
        .tiptap-notebook ul[data-type="taskList"] li input[type="checkbox"] { margin-top:8px; width:15px; height:15px; cursor:pointer; accent-color:#8b4513 }
        .tiptap-notebook .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color:#c0b090; font-style:italic; float:left; height:0; pointer-events:none;
        }
        .tiptap-notebook strong { color:#1a0e04 }
        .tiptap-notebook .ProseMirror {
          background-image: repeating-linear-gradient(
            transparent, transparent 31px, #c8d8ea 31px, #c8d8ea 32px
          );
          background-position-y: ${PAD_TOP - 1}px;
        }
      `}</style>

      <input ref={fileInputRef} type="file" accept="image/*"
        style={{ display: 'none' }} onChange={handleImageFile} />

      {/* ── Leather sidebar ── */}
      <div className="flex flex-col shrink-0" style={{
        width: 200,
        background: 'linear-gradient(175deg, #3b1a08 0%, #271005 60%, #1c0b03 100%)',
        borderRight: '4px solid #150802',
        boxShadow: 'inset -6px 0 14px rgba(0,0,0,0.35)',
      }}>
        <div style={{ padding: '18px 14px 12px', borderBottom: '1px solid rgba(212,165,90,0.18)' }}>
          <p style={{ color: '#c9935a', fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', fontFamily: 'sans-serif', marginBottom: 12 }}>
            Proyectos
          </p>
          <form onSubmit={createProject} style={{ display: 'flex', gap: 6 }}>
            <input type="text" value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
              placeholder="Nuevo proyecto..."
              style={{
                flex: 1, background: 'rgba(255,220,150,0.08)', color: '#f0dfc0',
                borderTop: 'none', borderRight: 'none', borderBottom: '1px solid rgba(212,165,90,0.25)', borderLeft: 'none',
                borderRadius: 6, padding: '5px 8px', fontSize: 12, fontFamily: 'sans-serif', outline: 'none', minWidth: 0,
              }} />
            <button type="submit" style={{
              background: '#8b4513', color: '#f5e6d0',
              border: 'none', borderRadius: 6, padding: '5px 10px',
              fontSize: 14, fontWeight: 'bold', cursor: 'pointer', fontFamily: 'sans-serif',
            }}>+</button>
          </form>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
          {projects.length === 0 ? (
            <p style={{ color: '#7a5030', fontSize: 12, textAlign: 'center', marginTop: 20, fontFamily: 'sans-serif' }}>
              Sin proyectos aún
            </p>
          ) : projects.map(p => (
            <button key={p.id} onClick={() => setSelected(p)} style={{
              width: '100%', textAlign: 'left', display: 'block',
              padding: '9px 10px 9px 14px', marginBottom: 2, borderRadius: 6,
              cursor: 'pointer', transition: 'all 0.15s',
              background: selected?.id === p.id ? 'rgba(212,165,90,0.18)' : 'transparent',
              border: 'none',
              borderLeft: `3px solid ${selected?.id === p.id ? '#c9935a' : 'transparent'}`,
              color: selected?.id === p.id ? '#f0dfc0' : '#9a7050',
              fontSize: 13, fontFamily: 'sans-serif',
            }}>
              {selected?.id === p.id ? '▶ ' : ''}{p.name}
            </button>
          ))}
        </div>

        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(212,165,90,0.12)' }}>
          <p style={{ color: '#5a3520', fontSize: 10, fontFamily: 'sans-serif', textAlign: 'center', letterSpacing: 1 }}>
            {projects.length} proyecto{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Spiral binding ── */}
      <div style={{
        width: 26, background: 'linear-gradient(180deg, #c8b890 0%, #b0a070 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'space-around', padding: '20px 0',
        borderRight: '1px solid #a09060', flexShrink: 0,
        boxShadow: '2px 0 6px rgba(0,0,0,0.2)',
      }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} style={{
            width: 18, height: 18, borderRadius: '50%',
            border: '2.5px solid #7a6840',
            background: 'radial-gradient(circle at 35% 35%, #e0d0a0, #9a8850)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            flexShrink: 0,
          }} />
        ))}
      </div>

      {/* ── Page area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#faf6ef', overflow: 'hidden', position: 'relative' }}>

        {/* Left margin red line */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 68,
          width: 1.5, background: '#e87878', opacity: 0.55, pointerEvents: 'none', zIndex: 1,
        }} />

        {/* Page header */}
        <div style={{
          padding: '10px 20px 8px 76px', borderBottom: '1.5px solid #c8d8ea',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, zIndex: 2,
        }}>
          {selected ? (
            <div>
              <p style={{ fontSize: 10, color: '#a09070', fontFamily: 'sans-serif', letterSpacing: 1, textTransform: 'uppercase' }}>Proyecto</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 17, color: '#2d2010', fontWeight: 'bold', lineHeight: 1.3 }}>{selected.name}</p>
                {projects.length > 1 && (
                  <div style={{ display: 'flex', gap: 3 }}>
                    <button onClick={() => navigateProject('left')} style={{
                      background: 'rgba(0,0,0,0.06)', border: '1px solid #d0c8b0', borderRadius: 4,
                      width: 22, height: 22, cursor: 'pointer', fontSize: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a6040',
                    }}>‹</button>
                    <button onClick={() => navigateProject('right')} style={{
                      background: 'rgba(0,0,0,0.06)', border: '1px solid #d0c8b0', borderRadius: 4,
                      width: 22, height: 22, cursor: 'pointer', fontSize: 12,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7a6040',
                    }}>›</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 14, color: '#c0b090', fontStyle: 'italic' }}>Seleccioná o creá un proyecto</p>
          )}
          <span style={{ fontSize: 11, color: '#b0a080', fontFamily: 'sans-serif' }}>
            {saving ? '✎ Guardando...' : selected ? '✓ Guardado' : ''}
          </span>
        </div>

        {/* Toolbar */}
        {selected && <Toolbar editor={editor} onImage={() => fileInputRef.current?.click()} />}

        {/* ── Page viewport (fixed height = 12 lines) ── */}
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#c8b890' }}>
              <p style={{ fontSize: 48, marginBottom: 10 }}>📖</p>
              <p style={{ fontSize: 15, fontStyle: 'italic' }}>Seleccioná o creá un proyecto</p>
            </div>
          </div>
        ) : (
          <>
            <div style={{
              flexShrink: 0, height: PAGE_HEIGHT,
              overflow: 'hidden', position: 'relative',
            }}>
              {/* EXIT: current page folds away in 3D */}
              {showExit && exitHtml && (
                <div
                  className="tiptap-notebook"
                  style={{
                    position: 'absolute', inset: 0, zIndex: 3,
                    transformOrigin: slideDir === 'left' ? 'right center' : 'left center',
                    animation: `${slideDir === 'left' ? 'nb3DOutLeft' : 'nb3DOutRight'} 0.3s ease-in forwards`,
                    background: '#faf6ef',
                    padding: `${PAD_TOP}px 28px ${PAD_BOTTOM}px 76px`,
                    backgroundImage: `repeating-linear-gradient(transparent,transparent 31px,#c8d8ea 31px,#c8d8ea 32px)`,
                    backgroundPositionY: `${PAD_TOP - 1}px`,
                    fontSize: '15px', lineHeight: '32px',
                    color: '#1a1408', fontFamily: 'Georgia,serif',
                    boxShadow: slideDir === 'left'
                      ? 'inset -8px 0 20px rgba(0,0,0,0.12)'
                      : 'inset 8px 0 20px rgba(0,0,0,0.12)',
                  }}
                  dangerouslySetInnerHTML={{ __html: exitHtml }}
                />
              )}

              {/* ENTER: new page unfolds in 3D */}
              <div
                className="tiptap-notebook"
                style={{
                  position: 'absolute', inset: 0, zIndex: 2,
                  transformOrigin: slideDir === 'left' ? 'left center' : 'right center',
                  animation: showEnter
                    ? `${slideDir === 'left' ? 'nb3DInFromRight' : 'nb3DInFromLeft'} 0.4s ease-out forwards`
                    : 'none',
                  background: '#faf6ef',
                }}
              >
                <EditorContent editor={editor} />
              </div>
            </div>

            {/* Page full indicator */}
            {pageFull && (
              <div style={{
                background: 'rgba(220,150,50,0.12)', borderTop: '1px solid rgba(201,147,90,0.3)',
                padding: '6px 76px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
              }}>
                <span style={{ fontSize: 12, color: '#a07030', fontFamily: 'sans-serif' }}>
                  📄 Página llena
                </span>
                <button onClick={addPage} style={{
                  background: '#8b4513', color: '#fde68a', border: 'none', borderRadius: 6,
                  padding: '3px 12px', fontSize: 12, fontFamily: 'sans-serif', fontWeight: 700, cursor: 'pointer',
                }}>
                  + Nueva página →
                </button>
              </div>
            )}

            {/* ── Page footer ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, padding: '7px 20px', flexShrink: 0,
              borderTop: '1.5px solid #c8d8ea', background: '#f0ebe0',
            }}>
              <button
                onClick={() => goToPage(pageIndex - 1)}
                disabled={pageIndex === 0 || transitioning.current}
                style={{
                  background: 'none', border: '1px solid #c8b890', borderRadius: 6,
                  width: 28, height: 28, cursor: pageIndex === 0 ? 'default' : 'pointer',
                  color: '#7a6040', opacity: pageIndex === 0 ? 0.25 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}
              >‹</button>

              <span style={{ fontSize: 12, color: '#9a8060', fontFamily: 'sans-serif', minWidth: 80, textAlign: 'center' }}>
                Hoja {pageIndex + 1} de {pages.length}
              </span>

              <button
                onClick={() => goToPage(pageIndex + 1)}
                disabled={pageIndex >= pages.length - 1 || transitioning.current}
                style={{
                  background: 'none', border: '1px solid #c8b890', borderRadius: 6,
                  width: 28, height: 28, cursor: pageIndex >= pages.length - 1 ? 'default' : 'pointer',
                  color: '#7a6040', opacity: pageIndex >= pages.length - 1 ? 0.25 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                }}
              >›</button>

              <div style={{ width: 1, height: 16, background: '#d0c8b0', margin: '0 4px' }} />

              <button
                onClick={addPage}
                title="Agregar hoja"
                style={{
                  background: 'none', border: '1px solid #c8b890', borderRadius: 6,
                  padding: '0 10px', height: 28, cursor: 'pointer',
                  color: '#8b4513', fontSize: 12, fontFamily: 'sans-serif', fontWeight: 600,
                }}
              >+ Hoja</button>
            </div>
          </>
        )}

        {/* Page curl */}
        <div style={{
          position: 'absolute', bottom: 0, right: 0, width: 0, height: 0,
          borderStyle: 'solid', borderWidth: '0 0 36px 36px',
          borderColor: 'transparent transparent #e0d8c8 transparent',
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  )
}
