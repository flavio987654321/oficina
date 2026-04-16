'use client'

type GestureCard = {
  hand: string
  name: string
  action: string
  panel: string
  color: string
}

const GESTURES: GestureCard[] = [
  // Universal
  { hand: '☝️', name: 'Cursor',        action: 'Mover el puntero por la pantalla',         panel: 'Universal',    color: '#60a0d0' },
  { hand: '🤏', name: 'Pinch',         action: 'Agarrar, seleccionar o dibujar',           panel: 'Universal',    color: '#fbbf24' },
  { hand: '✋', name: 'Palma abierta', action: 'Soltar / Activar modo selección',          panel: 'Universal',    color: '#4ade80' },
  { hand: '✌️', name: 'Victory',       action: 'Volver a la mesa principal',               panel: 'Universal',    color: '#34d399' },
  // Block de notas
  { hand: '☝️', name: 'Hover nota',    action: 'Apuntá a una nota para iluminarla',        panel: 'Block de notas', color: '#fef08a' },
  { hand: '🤏', name: 'Agarrar nota',  action: 'Pinch sobre una nota para levantarla',    panel: 'Block de notas', color: '#fbbf24' },
  { hand: '🗑',  name: 'Tirar al tacho', action: 'Arrastrá la nota al tacho del rincón',   panel: 'Block de notas', color: '#f87171' },
  // Cuaderno
  { hand: '👉', name: 'Swipe derecha', action: 'Ir a la hoja siguiente del cuaderno',     panel: 'Cuaderno',     color: '#c084fc' },
  { hand: '👈', name: 'Swipe izquierda', action: 'Ir a la hoja anterior del cuaderno',    panel: 'Cuaderno',     color: '#c084fc' },
  // Pizarra
  { hand: '🤏', name: 'Pinch + mover', action: 'Dibujá en la pizarra moviendo la mano',  panel: 'Pizarra',      color: '#60a0d0' },
  { hand: '✋', name: 'Palma',         action: 'Activar herramienta de selección',        panel: 'Pizarra',      color: '#4ade80' },
  { hand: '👊', name: 'Puño',          action: 'Activar el borrador de la pizarra',       panel: 'Pizarra',      color: '#f87171' },
]

const PANELS = ['Universal', 'Block de notas', 'Cuaderno', 'Pizarra']

const PANEL_COLORS: Record<string, string> = {
  'Universal':     '#c9935a',
  'Block de notas':'#fbbf24',
  'Cuaderno':      '#c084fc',
  'Pizarra':       '#60a0d0',
}

export default function GestureGuide({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16, fontFamily: 'sans-serif',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#0f0a05',
        border: '1px solid rgba(255,200,100,0.15)',
        borderRadius: 20,
        width: '100%', maxWidth: 780,
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 28px',
          borderBottom: '1px solid rgba(255,200,100,0.1)',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f5e6d0', letterSpacing: '-0.3px' }}>
              🖐 Guía de gestos
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7a6040' }}>
              Activá la cámara y usá tu mano para controlar la app
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, width: 36, height: 36, cursor: 'pointer',
            color: '#7a6040', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', padding: '24px 28px 32px' }}>
          {PANELS.map(panel => (
            <div key={panel} style={{ marginBottom: 36 }}>

              {/* Panel label */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: `${PANEL_COLORS[panel]}18`,
                border: `1px solid ${PANEL_COLORS[panel]}40`,
                borderRadius: 20, padding: '4px 14px', marginBottom: 16,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: PANEL_COLORS[panel], display: 'inline-block',
                }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: PANEL_COLORS[panel], letterSpacing: '0.05em' }}>
                  {panel.toUpperCase()}
                </span>
              </div>

              {/* Cards grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 14,
              }}>
                {GESTURES.filter(g => g.panel === panel).map((g, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${g.color}25`,
                    borderRadius: 14,
                    padding: '20px 16px 16px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 10, textAlign: 'center',
                    transition: 'background 0.15s',
                  }}>
                    {/* Hand */}
                    <div style={{
                      width: 72, height: 72, borderRadius: '50%',
                      background: `${g.color}15`,
                      border: `2px solid ${g.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 40, lineHeight: 1,
                    }}>
                      {g.hand}
                    </div>

                    {/* Name */}
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: g.color,
                      letterSpacing: '0.03em',
                    }}>
                      {g.name}
                    </span>

                    {/* Description */}
                    <span style={{
                      fontSize: 11, color: '#7a6040', lineHeight: 1.5,
                    }}>
                      {g.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Tips */}
          <div style={{
            background: 'rgba(255,200,100,0.05)',
            border: '1px solid rgba(255,200,100,0.1)',
            borderRadius: 12, padding: '16px 20px',
          }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#c9935a', letterSpacing: '0.05em' }}>
              💡 CONSEJOS
            </p>
            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                'Mantenés la mano a unos 30-50 cm de la cámara',
                'Iluminá bien la mano para mejor detección',
                'Hacé los gestos despacio y sostenidos',
                'El preview de cámara se puede ocultar haciendo clic en él',
                'Podés seguir usando el mouse normalmente mientras los gestos están activos',
              ].map((tip, i) => (
                <li key={i} style={{ fontSize: 12, color: '#7a6040', lineHeight: 1.5 }}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
