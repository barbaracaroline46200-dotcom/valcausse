import { cn } from '@/lib/utils'
import type { FamilleType, StatutContrat } from '@/types'

export function BadgeFamille({ famille }: { famille: FamilleType }) {
  return (
    <span className={famille === 'negoce' ? 'badge-negoce' : 'badge-appro'}>
      {famille === 'negoce' ? '🌾 Négoce' : '🌿 Appro'}
    </span>
  )
}

export function BadgeStatut({ statut }: { statut: StatutContrat }) {
  return (
    <span className={statut === 'clos' ? 'badge-clos' : 'badge-en_cours'}>
      {statut === 'clos' ? '✓ Clos' : '⏳ En cours'}
    </span>
  )
}

export function BadgeAlerte({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('badge-alerte', className)}>
      {children}
    </span>
  )
}

export function BadgeNombre({ n, rouge }: { n: number; rouge?: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold',
      rouge ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'
    )}>
      {n}
    </span>
  )
}
