'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FileText, ShoppingCart, Truck, BookOpen, Search, LogOut, ShieldCheck, Eye, BarChart2, CalendarDays, FileWarning, Receipt, Archive
} from 'lucide-react'
import { useAdmin } from './AdminProvider'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

const BRUN = '#7B2820'
const BRUN_LIGHT = '#fdf5f3'

const mainNav = [
  { href: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/contrats', label: 'Contrats achat', icon: FileText },
  { href: '/ventes', label: 'Contrats vente', icon: ShoppingCart },
  { href: '/transporteurs/factures', label: 'Transport & Factures', icon: Truck },
  { href: '/tarifs-transport', label: 'Tarifs transport', icon: Truck },
  { href: '/stats', label: 'Statistiques', icon: BarChart2 },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays, adminOnly: true },
  { href: '/referentiels', label: 'Référentiels', icon: BookOpen, adminOnly: true },
  { href: '/archives', label: 'Archives', icon: Archive },
  { href: '/recherche', label: 'Recherche globale', icon: Search },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { isAdmin, role, logout } = useAdmin()
  const [counts, setCounts] = useState({ livraisons: 0, cmr: 0, facturation: 0, rf: 0 })

  useEffect(() => {
    async function fetchCounts() {
      try {
        const res = await fetch('/api/dashboard')
        const d = await res.json()
        setCounts({
          livraisons: (d.livraisonsPlanifiees ?? []).length,
          cmr: (d.cmrEnAttente ?? []).length,
          facturation: (d.livraisonsAFacturer ?? []).length + (d.facturesManquantes ?? []).length,
          rf: (d.rfManquants ?? []).length,
        })
      } catch {}
    }
    fetchCounts()
  }, [pathname])

  const suiviNav = [
    { href: '/livraisons',  label: 'Livraisons à organiser', icon: Truck,        count: counts.livraisons,  color: BRUN },
    { href: '/cmr',         label: 'CMR en attente',         icon: FileWarning,  count: counts.cmr,         color: '#dc2626' },
    { href: '/facturation', label: 'Facturation en attente', icon: Receipt,      count: counts.facturation, color: '#448ab5' },
    { href: '/rf',          label: 'RF à récupérer',         icon: FileWarning,  count: counts.rf,          color: '#dc2626' },
  ]

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-40 shadow-sm">

      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <Link href="/">
          <Image
            src="/logo.png"
            alt="Valcausse — Coopérative agricole"
            width={180}
            height={54}
            priority
            className="w-auto h-12 object-contain"
          />
        </Link>
        <p className="text-xs mt-2 font-medium" style={{ color: '#C8941A' }}>
          Gestion des contrats céréales
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">

        {/* Navigation principale */}
        {mainNav.map(({ href, label, icon: Icon, adminOnly }) => {
          if (adminOnly && !isAdmin) return null
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <NavItem key={href} href={href} label={label} icon={<Icon size={18} />} active={active} />
          )
        })}

        {/* Séparateur Suivi livraisons */}
        <div className="pt-3 pb-1 px-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Suivi livraisons</p>
        </div>

        {suiviNav.map(({ href, label, icon: Icon, count, color }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={<Icon size={18} />}
              active={active}
              badge={count > 0 ? count : undefined}
              badgeColor={color}
            />
          )
        })}
      </nav>

      {/* Statut connexion */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1.5"
          style={{ backgroundColor: role === 'admin' ? '#fdf5f3' : '#f0fdf4' }}
        >
          {role === 'admin'
            ? <ShieldCheck size={15} style={{ color: BRUN }} />
            : <Eye size={15} className="text-green-600" />
          }
          <span className="text-xs font-semibold" style={{ color: role === 'admin' ? BRUN : '#15803d' }}>
            {role === 'admin' ? 'Administrateur' : 'Visiteur (lecture seule)'}
          </span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <LogOut size={15} />
          Se déconnecter
        </button>
      </div>
    </aside>
  )
}

function NavItem({
  href, label, icon, active, badge, badgeColor,
}: {
  href: string
  label: string
  icon: React.ReactNode
  active: boolean
  badge?: number
  badgeColor?: string
}) {
  return (
    <Link
      href={href}
      style={active ? { backgroundColor: BRUN_LIGHT, color: BRUN } : {}}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
        active ? 'font-semibold' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
      )}
    >
      <span style={active ? { color: BRUN } : { color: '#9ca3af' }} className="flex-shrink-0">
        {icon}
      </span>
      <span className="flex-1 leading-tight">{label}</span>
      {badge !== undefined ? (
        <span
          className="min-w-[20px] h-5 px-1.5 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: badgeColor ?? BRUN }}
        >
          {badge}
        </span>
      ) : (
        active && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#C8941A' }} />
      )}
    </Link>
  )
}
