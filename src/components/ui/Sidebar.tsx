'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FileText, ShoppingCart, Truck, BookOpen, Search, LogIn, LogOut
} from 'lucide-react'
import { useAdmin } from './AdminProvider'
import { useState } from 'react'
import AdminLoginModal from './AdminLoginModal'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/contrats', label: 'Contrats achat', icon: FileText },
  { href: '/ventes', label: 'Contrats vente', icon: ShoppingCart },
  { href: '/transporteurs/factures', label: 'Transport & Factures', icon: Truck },
  { href: '/referentiels', label: 'Référentiels', icon: BookOpen, adminOnly: true },
  { href: '/recherche', label: 'Recherche globale', icon: Search },
]

// Brun-bordeaux Valcausse
const BRUN = '#7B2820'
const BRUN_LIGHT = '#fdf5f3'

export default function Sidebar() {
  const pathname = usePathname()
  const { isAdmin, logout } = useAdmin()
  const [showLogin, setShowLogin] = useState(false)

  return (
    <>
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-40 shadow-sm">

        {/* Logo Valcausse officiel */}
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
          {navItems.map(({ href, label, icon: Icon, adminOnly }) => {
            if (adminOnly && !isAdmin) return null
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                style={active ? { backgroundColor: BRUN_LIGHT, color: BRUN } : {}}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                )}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = '#fafafa' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = '' }}
              >
                <Icon
                  size={18}
                  style={active ? { color: BRUN } : {}}
                  className={active ? '' : 'text-gray-400'}
                />
                {label}
                {active && (
                  <span
                    className="ml-auto w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: '#C8941A' }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Admin toggle */}
        <div className="px-3 py-4 border-t border-gray-100">
          {isAdmin ? (
            <div className="space-y-1.5">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: '#fdf5f3' }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#C8941A' }} />
                <span className="text-xs font-semibold" style={{ color: BRUN }}>Mode admin actif</span>
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <LogOut size={15} />
                Se déconnecter
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <LogIn size={15} />
              Connexion admin
            </button>
          )}
        </div>
      </aside>

      {showLogin && <AdminLoginModal onClose={() => setShowLogin(false)} />}
    </>
  )
}
