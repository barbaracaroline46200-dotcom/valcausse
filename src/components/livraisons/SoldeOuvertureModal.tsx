'use client'
import { useState } from 'react'
import { Loader2, PackageOpen } from 'lucide-react'

interface Props {
  contratId: string
  contratNumero: string
  quantiteTotale: number
  quantiteDejaLivree: number
  onClose: () => void
  onSaved: () => void
}

export default function SoldeOuvertureModal({ contratId, contratNumero, quantiteTotale, quantiteDejaLivree, onClose, onSaved }: Props) {
  const reliquat = Math.max(0, quantiteTotale - quantiteDejaLivree)
  const [tonnage, setTonnage] = useState(reliquat > 0 ? '' : '')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qte = parseFloat(tonnage)
    if (!qte || qte <= 0) { setError('Saisir un tonnage valide.'); return }
    if (qte > quantiteTotale) { setError(`Le solde ne peut pas dépasser la quantité totale du contrat (${quantiteTotale} t).`); return }

    setSaving(true)
    setError('')
    const res = await fetch('/api/livraisons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contrat_achat_id: contratId,
        type: 'realisee',
        quantite_reelle: qte,
        date_reelle: date,
        ville_chargement: 'Solde ouverture',
        ville_destination: 'Migration Google Sheet',
        // Marquer pour ne pas apparaître dans CMR/facturation
        numero_lettre_voiture: 'SOLDE-OUVERTURE',
        transport_facture: true,
        facture_fournisseur_id: null,
      }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Erreur lors de la création')
      setSaving(false)
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#fff3d0' }}>
            <PackageOpen size={20} style={{ color: '#a37514' }} />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Solde d'ouverture — migration</h2>
            <p className="text-sm text-gray-500 mt-0.5">Contrat {contratNumero}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Explication */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800">
            Saisir ici le <strong>tonnage déjà livré avant la migration</strong> depuis ton Google Sheet.
            Cette entrée permettra au logiciel de calculer correctement le reliquat restant à livrer.
          </div>

          {/* Contexte */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg px-3 py-2.5">
              <p className="text-xs text-gray-400 mb-0.5">Quantité totale contrat</p>
              <p className="font-bold text-gray-800">{quantiteTotale} t</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2.5">
              <p className="text-xs text-gray-400 mb-0.5">Déjà saisi dans l'app</p>
              <p className="font-bold text-gray-800">{quantiteDejaLivree} t</p>
            </div>
          </div>

          {/* Tonnage */}
          <div>
            <label className="label">Tonnage déjà livré (hors app) <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={quantiteTotale}
                value={tonnage}
                onChange={e => setTonnage(e.target.value)}
                placeholder={`ex. ${Math.max(0, quantiteTotale - quantiteDejaLivree).toFixed(2)}`}
                className="input pr-8"
                autoFocus
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">t</span>
            </div>
            {tonnage && !isNaN(parseFloat(tonnage)) && (
              <p className="text-xs text-gray-500 mt-1">
                Reliquat restant après migration : <strong>{Math.max(0, quantiteTotale - quantiteDejaLivree - parseFloat(tonnage)).toFixed(2)} t</strong>
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="label">Date de référence</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="input"
            />
            <p className="text-xs text-gray-400 mt-1">Date approximative de la dernière livraison avant migration.</p>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={saving || !tonnage} className="btn-primary flex-1 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <PackageOpen size={15} />}
              Enregistrer le solde
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
