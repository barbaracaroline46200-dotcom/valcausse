'use client'
import { Search, Bell, Wheat } from 'lucide-react'
import { useAdmin } from './AdminProvider'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Header() {
  const { role } = useAdmin()
  const [search, setSearch] = useState('')
  const router = useRouter()

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (search.trim()) {
      router.push(`/recherche?q=${encodeURIComponent(search.trim())}`)
      setSearch('')
    }
  }

  return (
    <header
      className="fixed top-0 left-64 right-0 h-14 z-30 flex items-center justify-between px-6 border-b"
      style={{ backgroundColor: '#ffffff', borderColor: '#f0ece6' }}
    >
      {/* Recherche */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un contrat, agriculteur, fournisseur…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
          />
        </div>
      </form>

      {/* Droite : notif + profil */}
      <div className="flex items-center gap-3 ml-4">
        <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
          <Bell size={16} />
        </button>
        <div className="flex items-center gap-2.5 pl-3 border-l border-gray-200">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#7B2820' }}
          >
            <Wheat size={15} className="text-white" />
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-gray-800 leading-tight">Valcausse</p>
            <p className="text-xs leading-tight" style={{ color: '#C8941A' }}>
              {role === 'admin' ? 'Administrateur' : 'Visiteur'}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
