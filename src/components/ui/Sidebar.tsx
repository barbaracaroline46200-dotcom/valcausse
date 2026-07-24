'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FileText, ShoppingCart, Truck, BookOpen, Search, LogOut, ShieldCheck, Eye, BarChart2, CalendarDays, FileWarning, Receipt, Archive, CreditCard
} from 'lucide-react'
import { useAdmin } from './AdminProvider'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

const BRUN = '#7B2820'
const BRUN_LIGHT = '#fdf5f3'

export default function Sidebar() {
  const pathname = usePathname()
  const { isAdmin, role, logout } = useAdmin()
  const [counts, setCounts] = useState({ livraisons: 0, cmr: 0, facturation: 0, rf: 0, prixADefinir: 0 })

  useEffect(() => {
    async function fetchCounts() {
      try {
        const res = await fetch('/api/dashboard')
        const d = await res.json()
        setCounts({
          livraisons: (d.livraisonsPlanifiees ?? []).length,
          cmr: (d.cmrEnAttente ?? []).length,
          facturation: (d.livraisonsAFacturer ?? []).length + (d.livraisonsAVerifierClient ?? []).length + (d.livraisonsAFacturerClient ?? []).length,
          rf: (d.rfManquants ?? []).length,
          prixADefinir: (d.contratsSansPrix ?? []).length,
        })
      } catch {}
    }
    fetchCounts()
  }, [pathname])

  function active(href: string) {
    return pathname === href || (href !== '/' && pathname.startsWith(href + '/'))
  }

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

        {/* PILOTAGE */}
        <SectionLabel label="Pilotage" />
        <NavItem href="/"              label="Tableau de bord"   icon={<LayoutDashboard size={18} />} active={active('/')} />
        <NavItem href="/stats"         label="Statistiques"      icon={<BarChart2 size={18} />}       active={active('/stats')} />
        <NavItem href="/recherche"     label="Recherche globale" icon={<Search size={18} />}          active={active('/recherche')} />

        {/* CONTRATS */}
        <SectionLabel label="Contrats" />
        <NavItem href="/contrats"      label="Contrats achat"    icon={<FileText size={18} />}        active={active('/contrats')} badge={counts.prixADefinir > 0 ? counts.prixADefinir : undefined} badgeColor="#dc2626" />
        <NavItem href="/ventes"        label="Contrats vente"    icon={<ShoppingCart size={18} />}    active={active('/ventes')} />
        <NavItem href="/archives"      label="Archives"          icon={<Archive size={18} />}         active={active('/archives')} />

        {/* LIVRAISONS */}
        <SectionLabel label="Livraisons" />
        <NavItem href="/livraisons"    label="À organiser"       icon={<Truck size={18} />}           active={active('/livraisons')} badge={counts.livraisons > 0 ? counts.livraisons : undefined} badgeColor={BRUN} />
        <NavItem href="/cmr"           label="CMR en attente"    icon={<FileWarning size={18} />}     active={active('/cmr')}        badge={counts.cmr > 0 ? counts.cmr : undefined}               badgeColor="#dc2626" />
        <NavItem href="/planning"      label="Planning"          icon={<LayoutDashboard size={18} />} active={active('/planning')} />

        {/* FACTURATION */}
        <SectionLabel label="Facturation" />
        <NavItem href="/facturation"   label="En attente"        icon={<CreditCard size={18} />}      active={active('/facturation')} badge={counts.facturation > 0 ? counts.facturation : undefined} badgeColor="#448ab5" />
        <NavItem href="/rf"            label="RF à récupérer"    icon={<FileWarning size={18} />}     active={active('/rf')}          badge={counts.rf > 0 ? counts.rf : undefined}                   badgeColor="#dc2626" />

        {/* TRANSPORT */}
        <SectionLabel label="Transport" />
        <NavItem href="/transporteurs/factures" label="Transport & Factures" icon={<Truck size={18} />}     active={active('/transporteurs/factures')} />
        <NavItem href="/tarifs-transport"       label="Tarifs transport"     icon={<CreditCard size={18} />} active={active('/tarifs-transport')} />

        {/* ADMINISTRATION (admin uniquement) */}
        {isAdmin && (
          <>
            <SectionLabel label="Administration" icon={<ShieldCheck size={12} style={{ color: '#C8941A' }} />} />
            <NavItem href="/agenda"       label="Agenda"        icon={<CalendarDays size={18} />} active={active('/agenda')} />
            <NavItem href="/referentiels" label="Référentiels"  icon={<BookOpen size={18} />}    active={active('/referentiels')} />
          </>
        )}
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

function SectionLabel({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div className="pt-4 pb-1 px-3 flex items-center gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      {icon}
    </div>
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
  const BRUN = '#7B2820'
  const BRUN_LIGHT = '#fdf5f3'
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
