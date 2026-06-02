'use client'
import { useState, useEffect } from 'react'
import { useAdmin } from './AdminProvider'
import LoginScreen from './LoginScreen'
import { Loader2 } from 'lucide-react'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAdmin()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Avant hydratation : écran de chargement neutre (évite le flash blanc)
  if (!mounted) {
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

  if (!isLoggedIn) {
    return <LoginScreen />
  }

  return <>{children}</>
}
