'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAdmin } from './AdminProvider'
import LoginScreen from './LoginScreen'
import { Loader2 } from 'lucide-react'

// Pages accessibles au rôle visiteur — tout le reste redirige vers la première de la liste
const VISITEUR_ALLOWED_PREFIXES = ['/contrats', '/ventes', '/archives', '/planning', '/tarifs-transport']
const VISITEUR_DEFAULT_PATH = '/contrats'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center"
         style={{ background: 'linear-gradient(135deg, #fdf5f3 0%, #f5f0e8 100%)' }}>
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-md"
             style={{ backgroundColor: '#7B2820' }}>
          <Loader2 size={24} className="text-white animate-spin" />
        </div>
        <p className="text-sm font-medium" style={{ color: '#7B2820' }}>Valcausse</p>
        <p className="text-xs text-gray-400 mt-0.5">Chargement...</p>
      </div>
    </div>
  )
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, role } = useAdmin()
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  const pathAllowed = role !== 'visiteur' || VISITEUR_ALLOWED_PREFIXES.some(
    p => pathname === p || pathname.startsWith(p + '/')
  )

  useEffect(() => {
    if (mounted && isLoggedIn && !pathAllowed) router.replace(VISITEUR_DEFAULT_PATH)
  }, [mounted, isLoggedIn, pathAllowed, router])

  // Avant hydratation : écran de chargement neutre (évite le flash blanc)
  if (!mounted) return <LoadingScreen />

  if (!isLoggedIn) {
    return <LoginScreen />
  }

  // Page hors périmètre visiteur : ne pas monter son contenu pendant la redirection
  if (!pathAllowed) return <LoadingScreen />

  return <>{children}</>
}
