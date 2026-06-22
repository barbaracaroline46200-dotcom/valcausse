'use client'
import { Search, Bell, Truck, FileWarning, Receipt, AlertTriangle, X } from 'lucide-react'
import { useAdmin } from './AdminProvider'
import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

type AlertItem = { href: string; label: string; count: number; icon: React.ReactNode; color: string }

export default function Header() {
  const { role } = useAdmin()
  const [search, setSearch] = useState('')
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [total, setTotal] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Fermer au clic extérieur
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Fermer en changeant de page
  useEffect(() => { setOpen(false) }, [pathname])

  // Charger les alertes depuis /api/dashboard
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dashboard')
        const d = await res.json()
        const livraisons  = (d.livraisonsPlanifiees ?? []).length
        const cmr         = (d.cmrEnAttente ?? []).length
        const facturation = (d.livraisonsAFacturer ?? []).length + (d.livraisonsAVerifierClient ?? []).length + (d.livraisonsAFacturerClient ?? []).length
        const rf          = (d.rfManquants ?? []).length
        const alerte      = (d.contratsAlerte ?? []).filter((c: any) => {
          const rel = (c.quantite_totale ?? 0) - (c.livraisons ?? []).filter((l: any) => l.type === 'realisee').reduce((s: number, l: any) => s + (l.quantite_reelle ?? 0), 0)
          return rel > 0
        }).length

        const items: AlertItem[] = [
          { href: '/livraisons',  label: 'Livraisons à organiser',  count: livraisons,  icon: <Truck size={15} />,        color: '#7B2820' },
          { href: '/cmr',         label: 'CMR en attente',          count: cmr,         icon: <FileWarning size={15} />,   color: '#dc2626' },
          { href: '/facturation', label: 'Facturation en attente',  count: facturation, icon: <Receipt size={15} />,       color: '#448ab5' },
          { href: '/rf',          label: 'RF à récupérer',          count: rf,          icon: <FileWarning size={15} />,   color: '#dc2626' },
          { href: '/contrats',    label: 'Contrats en alerte',      count: alerte,      icon: <AlertTriangle size={15} />, color: '#d97706' },
        ].filter(i => i.count > 0)

        setAlerts(items)
        setTotal(items.reduce((s, i) => s + i.count, 0))
      } catch {}
    }
    load()
    // Rafraîchir toutes les 2 minutes
    const interval = setInterval(load, 120_000)
    return () => clearInterval(interval)
  }, [pathname])

  // Pages qui supportent la recherche contextuelle (filtrage local)
  const PAGES_CONTEXTUELLES = ['/contrats', '/ventes', '/archives', '/livraisons', '/cmr', '/facturation', '/rf']
  const pageContextuelle = PAGES_CONTEXTUELLES.find(p => pathname === p || pathname.startsWith(p + '/'))

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!search.trim()) return
    const dest = pageContextuelle
      ? `${pageContextuelle}?q=${encodeURIComponent(search.trim())}`
      : `/recherche?q=${encodeURIComponent(search.trim())}`
    router.push(dest)
    setSearch('')
  }

  // Placeholder selon la page
  const placeholder = pageContextuelle
    ? `Rechercher dans cette page…`
    : 'Rechercher un contrat, agriculteur, fournisseur…'

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
            placeholder={placeholder}
            className="w-full pl-9 pr-14 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 text-[10px] text-gray-400 font-medium border border-gray-200 rounded px-1 py-0.5 bg-white pointer-events-none">
            ⌘K
          </span>
        </div>
      </form>

      {/* Droite : cloche + profil */}
      <div className="flex items-center gap-3 ml-4">

        {/* Cloche avec dropdown */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(o => !o)}
            className="relative w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Bell size={16} />
            {total > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[17px] h-[17px] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-0.5"
                style={{ backgroundColor: '#dc2626' }}
              >
                {total > 99 ? '99+' : total}
              </span>
            )}
          </button>

          {open && (
            <div
              className="absolute right-0 top-10 w-72 rounded-xl shadow-xl border overflow-hidden z-50"
              style={{ backgroundColor: '#fff', borderColor: '#ede9e3' }}
            >
              {/* Header panneau */}
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#f0ece6', backgroundColor: '#fdf5f3' }}>
                <span className="text-sm font-bold" style={{ color: '#7B2820' }}>
                  Alertes en cours
                </span>
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              </div>

              {/* Liste */}
              {alerts.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  ✓ Tout est à jour
                </div>
              ) : (
                <div className="py-1">
                  {alerts.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: item.color + '18', color: item.color }}
                      >
                        {item.icon}
                      </span>
                      <span className="flex-1 text-sm text-gray-700">{item.label}</span>
                      <span
                        className="min-w-[22px] h-5 px-1.5 rounded-full text-white text-xs font-bold flex items-center justify-center"
                        style={{ backgroundColor: item.color }}
                      >
                        {item.count}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="px-4 py-2 border-t text-xs text-gray-400 text-center" style={{ borderColor: '#f0ece6' }}>
                Mis à jour à chaque navigation
              </div>
            </div>
          )}
        </div>

        {/* Date & heure */}
        <div className="hidden md:flex flex-col items-end pl-3 border-l border-gray-200 pr-3 border-r">
          <span className="text-xs font-semibold text-gray-700 leading-tight tabular-nums">
            {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="text-[11px] text-gray-400 leading-tight capitalize">
            {now.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>

        {/* Profil */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
            style={{ backgroundColor: '#7B2820' }}
          >
            VC
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-gray-800 leading-tight">Coopérative Valcausse</p>
            <p className="text-xs leading-tight text-gray-400">
              {role === 'admin' ? 'Administrateur' : 'Visiteur'}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
