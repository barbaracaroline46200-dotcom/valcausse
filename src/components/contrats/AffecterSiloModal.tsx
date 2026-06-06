'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { Warehouse } from 'lucide-react'

interface Props {
  contrat: any
  siloExistant?: any // contrat_vente silo déjà existant (pour modification)
  onClose: () => void
  onSaved: () => void
}

const SILOS = ['Silo', 'Silo gare']

export default function AffecterSiloModal({ contrat, siloExistant, onClose, onSaved }: Props) {
  const [siloNom, setSiloNom] = useState<string>(siloExistant?.silo_nom ?? '')
  const [quantite, setQuantite] = useState<string>(siloExistant?.quantite?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!siloExistant

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const qte = parseFloat(quantite)
    if (!siloNom) { setError('Choisir un silo.'); return }
    if (!qte || qte <= 0) { setError('Saisir une quantité valide.'); return }

    setSaving(true)
    setError('')

    if (isEdit) {
      const res = await fetch(`/api/ventes/${siloExistant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ silo_nom: siloNom, quantite: qte }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erreur'); setSaving(false); return }
    } else {
      const res = await fetch('/api/ventes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contrat_achat_id: contrat.id,
          produit_id: contrat.produit_id,
          destination_silo: true,
          silo_nom: siloNom,
          quantite: qte,
          numero_contrat: null,
          agriculteur_id: null,
          prix_vente: null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erreur'); setSaving(false); return }
    }
    onSaved()
  }

  return (
    <Modal title={isEdit ? 'Modifier affectation silo' : 'Affecter au silo'} onClose={onClose} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <Warehouse size={16} className="mt-0.5 flex-shrink-0" />
          <span>Cette quantité sera stockée dans un de vos silos. Pas de facturation client générée.</span>
        </div>

        <div>
          <label className="label">Silo *</label>
          <div className="flex gap-2">
            {SILOS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSiloNom(s)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  siloNom === s
                    ? 'bg-amber-600 border-amber-600 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-amber-300 hover:bg-amber-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Quantité (t) *</label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={quantite}
              onChange={e => setQuantite(e.target.value)}
              className="input pr-8"
              placeholder="ex. 30.00"
              autoFocus
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">t</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Quantité totale contrat : <strong>{contrat.quantite_totale} t</strong>
          </p>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button type="submit" disabled={saving || !siloNom || !quantite} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Affecter'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
