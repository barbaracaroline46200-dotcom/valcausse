'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MOIS_NOMS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

interface Livraison {
  id: string
  type: string
  date_reelle?: string | null
  date_prevue?: string | null
  mois_prevu?: string | null
  quantite_reelle?: number | null
  quantite_prevue?: number | null
  contrat_vente_id?: string | null
  contrats_vente?: any[]
}

interface Props {
  livraisons: Livraison[]
  produitNom?: string
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Renvoie les jours de la grille du mois (lundi en premier, complété pour remplir les semaines)
function getGrilleMois(year: number, month: number): (Date | null)[] {
  const premier = new Date(year, month, 1)
  const dernier = new Date(year, month + 1, 0)
  const premierJour = (premier.getDay() || 7) - 1 // 0 = lundi
  const grille: (Date | null)[] = []
  for (let i = 0; i < premierJour; i++) grille.push(null)
  for (let d = 1; d <= dernier.getDate(); d++) grille.push(new Date(year, month, d))
  while (grille.length % 7 !== 0) grille.push(null)
  return grille
}

export default function CalendrierContrat({ livraisons, produitNom }: Props) {
  const now = new Date()
  const [mois, setMois] = useState(now.getMonth())
  const [annee, setAnnee] = useState(now.getFullYear())

  function prev() {
    if (mois === 0) { setMois(11); setAnnee(a => a - 1) }
    else setMois(m => m - 1)
  }
  function next() {
    if (mois === 11) { setMois(0); setAnnee(a => a + 1) }
    else setMois(m => m + 1)
  }
  function goToday() { setMois(now.getMonth()); setAnnee(now.getFullYear()) }

  const grille = getGrilleMois(annee, mois)

  // Livraisons sans date fixe du mois courant
  const livsNonFixees = livraisons.filter(l => {
    if (l.type === 'realisee' || l.date_prevue) return false
    if (!l.mois_prevu) return false
    const d = new Date(l.mois_prevu)
    return d.getFullYear() === annee && d.getMonth() === mois
  })

  function getLivsForDay(day: Date): Livraison[] {
    return livraisons.filter(l => {
      const dateStr = l.type === 'realisee' ? l.date_reelle : l.date_prevue
      if (!dateStr) return false
      return isSameDay(new Date(dateStr), day)
    })
  }

  const isCurrentMois = mois === now.getMonth() && annee === now.getFullYear()

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: '#fdf5f3' }}>
        <span className="font-bold text-sm capitalize" style={{ color: '#7B2820' }}>
          {MOIS_NOMS[mois]} {annee}
        </span>
        <div className="flex items-center gap-1.5">
          {!isCurrentMois && (
            <button onClick={goToday} className="px-2 py-0.5 rounded text-xs border border-gray-200 text-gray-500 hover:bg-white">Auj.</button>
          )}
          <button onClick={prev} className="p-1 rounded hover:bg-white border border-gray-200">
            <ChevronLeft size={14} className="text-gray-600" />
          </button>
          <button onClick={next} className="p-1 rounded hover:bg-white border border-gray-200">
            <ChevronRight size={14} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Livraisons non fixées du mois */}
      {livsNonFixees.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-400 mr-1">Non fixées :</span>
          {livsNonFixees.map(l => (
            <span key={l.id} className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
              {l.quantite_prevue ?? '?'} t
            </span>
          ))}
        </div>
      )}

      {/* Grille */}
      <div className="p-3">
        {/* En-têtes */}
        <div className="grid grid-cols-7 mb-1">
          {JOURS.map(j => (
            <div key={j} className="text-center text-xs font-semibold text-gray-400 py-1">{j}</div>
          ))}
        </div>

        {/* Semaines */}
        <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-lg overflow-hidden">
          {grille.map((day, i) => {
            if (!day) return <div key={i} className="bg-gray-50 min-h-[52px]" />
            const livsJour = getLivsForDay(day)
            const isToday = isSameDay(day, now)
            const isAutreMois = day.getMonth() !== mois

            return (
              <div
                key={i}
                className={`bg-white min-h-[52px] p-1 ${isAutreMois ? 'opacity-30' : ''}`}
              >
                <div className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full mb-0.5 ${
                  isToday ? 'bg-red-700 text-white' : 'text-gray-500'
                }`}>
                  {day.getDate()}
                </div>
                <div className="space-y-0.5">
                  {livsJour.map(l => {
                    const isReal = l.type === 'realisee'
                    const qte = isReal ? l.quantite_reelle : l.quantite_prevue
                    return (
                      <div
                        key={l.id}
                        className="rounded text-xs px-1 py-0.5 font-medium truncate"
                        style={isReal
                          ? { backgroundColor: '#dcfce7', color: '#15803d' }
                          : { backgroundColor: '#fef3c7', color: '#92400e' }
                        }
                        title={`${isReal ? 'Réalisée' : 'Planifiée'} · ${qte ?? '?'} t`}
                      >
                        {qte ?? '?'} t
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Légende */}
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: '#dcfce7', border: '1px solid #16a34a' }} />
            Réalisée
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: '#fef3c7', border: '1px solid #d97706' }} />
            Planifiée
          </div>
        </div>
      </div>
    </div>
  )
}
