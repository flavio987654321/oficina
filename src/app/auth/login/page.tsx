'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email o contraseña incorrectos'); setLoading(false) }
    else router.push('/dashboard')
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f4f4f5',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif", padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg, #1c1917, #44403c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fbbf24', fontWeight: 800, fontSize: 22,
            margin: '0 auto 14px',
          }}>O</div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#18181b', letterSpacing: '-0.4px' }}>
            Iniciar sesión
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#71717a' }}>
            Bienvenido de vuelta a Oficina
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: 32,
          border: '1px solid #e4e4e7',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#3f3f46', marginBottom: 7 }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com" required
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#71717a')}
                onBlur={e => (e.target.style.borderColor = '#e4e4e7')}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#3f3f46', marginBottom: 7 }}>
                Contraseña
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#71717a')}
                onBlur={e => (e.target.style.borderColor = '#e4e4e7')}
              />
            </div>

            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 8, padding: '10px 14px',
              }}>
                <p style={{ margin: 0, fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              background: '#18181b', border: 'none', borderRadius: 10,
              padding: '12px', color: '#fff', fontWeight: 600,
              fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', width: '100%',
              opacity: loading ? 0.65 : 1, transition: 'opacity 0.15s, background 0.15s',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
            }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = '#27272a' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#18181b' }}
            >
              {loading && (
                <span style={{
                  width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff', borderRadius: '50%',
                  display: 'inline-block', animation: 'spin 0.7s linear infinite',
                }} />
              )}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#71717a' }}>
          ¿No tenés cuenta?{' '}
          <Link href="/auth/register" style={{ color: '#18181b', fontWeight: 600, textDecoration: 'none' }}>
            Registrate
          </Link>
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#fafafa',
  border: '1px solid #e4e4e7', borderRadius: 10,
  padding: '11px 14px', color: '#18181b', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s', fontFamily: 'inherit',
}
