'use client'
import { useMemo, useState } from 'react'
import { Receipt, FileDown } from 'lucide-react'
import { montantEnLettres } from '@/lib/nombre-lettres'

const PRIX_PART = 1.52

export default function AttestationCapitalSocialPage() {
  const [nom, setNom] = useState('')
  const [adresse, setAdresse] = useState('')
  const [montant, setMontant] = useState('')

  const montantNum = Number(montant.replace(',', '.'))
  const montantValide = montant !== '' && !isNaN(montantNum) && montantNum > 0
  const nbParts = montantValide ? Math.round(montantNum / PRIX_PART) : null
  // Le nombre de parts est toujours un compte rond — un écart notable signale
  // un montant qui n'est pas un multiple de 1,52€ (erreur de saisie probable).
  const ecartSuspect = montantValide && nbParts !== null && Math.abs(montantNum - nbParts * PRIX_PART) > 0.01
  const montantLettres = montantValide ? montantEnLettres(montantNum) : ''

  const formValide = nom.trim() !== '' && adresse.trim() !== '' && montantValide

  const pdfHref = useMemo(() => {
    if (!formValide) return ''
    const params = new URLSearchParams({ nom: nom.trim(), adresse: adresse.trim(), montant: String(montantNum) })
    return `/api/pdf/attestation-capital?${params.toString()}`
  }, [formValide, nom, adresse, montantNum])

  return (
    <div className="space-y-6 pb-10 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
          <Receipt size={22} />
          Attestation de capital social
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Renseigne le détenteur et le montant, le PDF est généré automatiquement</p>
      </div>

      <div className="card space-y-4">
        <div>
          <label className="label">Nom / Raison sociale</label>
          <input
            className="input"
            value={nom}
            onChange={e => setNom(e.target.value)}
            placeholder="SCA LES RIVES"
          />
        </div>

        <div>
          <label className="label">Adresse</label>
          <textarea
            className="input"
            rows={3}
            value={adresse}
            onChange={e => setAdresse(e.target.value)}
            placeholder={'3473 ROUTE DE BORDEAUX\n82000 MONTAUBAN'}
          />
          <p className="text-xs text-gray-400 mt-1">Une ligne par ligne d'adresse (rue, puis code postal + ville)</p>
        </div>

        <div>
          <label className="label">Montant du capital social (€)</label>
          <input
            className="input"
            inputMode="decimal"
            value={montant}
            onChange={e => setMontant(e.target.value)}
            placeholder="15.20"
          />
        </div>

        {montantValide && (
          <div className={`rounded-lg p-3 text-sm space-y-1 ${ecartSuspect ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-100'}`}>
            <p><span className="text-gray-500">Nombre de parts : </span><span className="font-semibold">{nbParts}</span> <span className="text-gray-400">(à {PRIX_PART.toFixed(2)}€ la part)</span></p>
            <p><span className="text-gray-500">En toutes lettres : </span><span className="font-semibold capitalize">{montantLettres}</span></p>
            {ecartSuspect && (
              <p className="text-amber-700 text-xs">⚠️ Ce montant n'est pas un multiple exact de 1,52€ — vérifie la saisie.</p>
            )}
          </div>
        )}

        <a
          href={pdfHref || undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => { if (!formValide) e.preventDefault() }}
          className={`btn-primary inline-flex items-center gap-2 ${!formValide ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
        >
          <FileDown size={16} /> Générer le PDF
        </a>
      </div>
    </div>
  )
}
