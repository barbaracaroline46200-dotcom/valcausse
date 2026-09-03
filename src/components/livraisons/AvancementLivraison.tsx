'use client'
import { formatDate } from '@/lib/annee-agricole'

interface Props {
  livraison: any
  isAdmin?: boolean
  /** Si omis, l'indicateur est en lecture seule (pas de clic). */
  onToggle?: (livraisonId: string, field: string, current: boolean) => void
}

const ETAPES = [
  { field: 'agriculteur_contacte', label: 'Agriculteur contacté', color: 'bg-blue-500' },
  { field: 'pdf_envoye', label: 'PDF transporteur envoyé', color: 'bg-orange-500' },
  { field: 'transporteur_contacte', label: 'Transporteur confirmé', color: 'bg-green-500' },
] as const

/** Aperçu compact de l'avancement d'une livraison planifiée : date connue
 *  (prévue si ferme, sinon souhaitée) + les 3 étapes du suivi transport. */
export default function AvancementLivraison({ livraison: l, isAdmin, onToggle }: Props) {
  const dateFerme = l.date_prevue ? formatDate(l.date_prevue) : (l.semaine_prevue ? `Sem. ${l.semaine_prevue}` : null)
  const dateSouhaitee = l.date_souhaitee ? formatDate(l.date_souhaitee) : (l.semaine_souhaitee ? `Sem. ${l.semaine_souhaitee}` : null)

  return (
    <div className="flex flex-col gap-1.5 min-w-[130px]">
      {dateFerme ? (
        <span className="text-xs font-semibold text-green-700">📅 {dateFerme}</span>
      ) : dateSouhaitee ? (
        <span className="text-xs font-medium text-blue-600">Souhait : {dateSouhaitee}</span>
      ) : (
        <span className="text-xs text-gray-400">Aucune date</span>
      )}
      <div className="flex items-center gap-1">
        {ETAPES.map((etape, i) => {
          const done = !!l[etape.field]
          const clickable = !!onToggle && isAdmin
          return (
            <button
              key={etape.field}
              type="button"
              disabled={!clickable}
              onClick={() => onToggle && onToggle(l.id, etape.field, done)}
              title={`${etape.label}${done ? ' — fait' : ''}`}
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                done ? `${etape.color} text-white` : 'bg-gray-200 text-gray-400'
              } ${clickable ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}
