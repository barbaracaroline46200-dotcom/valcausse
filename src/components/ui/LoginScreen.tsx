'use client'
import { useState } from 'react'
import { useAdmin } from './AdminProvider'
import { Lock, Loader2 } from 'lucide-react'

export default function LoginScreen() {
  const { login } = useAdmin()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await login(password)
    setLoading(false)
    if (!result) {
      setError('Mot de passe incorrect')
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4"
         style={{ background: 'linear-gradient(135deg, #fdf5f3 0%, #f5f0e8 100%)' }}>
      <div className="w-full max-w-sm">
        {/* Logo / En-tête */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-md"
               style={{ backgroundColor: '#7B2820' }}>
            <Lock size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#7B2820' }}>Valcausse</h1>
          <p className="text-gray-500 text-sm mt-1">Gestion des contrats céréales</p>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="font-bold text-gray-800 mb-5 text-center">Connexion</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                autoFocus
              />
              {error && (
                <p className="text-red-600 text-sm mt-1.5 flex items-center gap-1">
                  <span>⚠️</span> {error}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !password}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Connexion...</>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              Deux niveaux d'accès disponibles :<br />
              <span className="font-medium text-gray-500">Visiteur</span> (lecture seule) · <span className="font-medium text-gray-500">Admin</span> (modification)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
