'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/annee-agricole'

interface Props {
  contratVente: {
    id: string
    numero_contrat: string
    agriculteur?: { nom: string }
    factures_client?: any[]
  }
  contratAchatId: string
  onClose: () => void
  onSaved: () => void
}

const MODES_PAIEMENT = [
  { value: 'virement', label: 'Virement' },
  { value: 'prelevement', label: 'Prélèvement' },
  { value: 'lcr', label: 'LCR' },
]

const FORM_VIDE = {
  numero_facture_logiciel: '',
  montant_ht: '',
  montant_ttc: '',
  mode_paiement: '',
  date_paiement: '',
}

export default function GererFacturesClientModal({ contratVente, contratAchatId, onClose, onSaved }: Props) {
  const [factures, setFactures] = useState<any[]>(contratVente.factures_client ?? [])
  const [form, setForm] = useState(FORM_VIDE)
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState('')

  function f(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  async function ajouterFacture(e: React.FormEvent) {
    e.preventDefault()
    if (!form.numero_facture_logiciel) { setError('Le N° FAT est obligatoire'); return }
    setSaving(true)
    setError('')
    const body = {
      contrat_vente_id: contratVente.id,
      numero_facture_logiciel: form.numero_facture_logiciel,
      montant_ht: form.montant_ht ? parseFloat(form.montant_ht) : null,
      montant_ttc: form.montant_ttc ? parseFloat(form.montant_ttc) : null,
      mode_paiement: form.mode_paiement || null,
      date_paiement: form.date_paiement || null,
    }
    const res = await fetch('/api/factures/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Erreur lors de la création')
      setSaving(false)
      return
    }
    const nouvelle = await res.json()
    setFactures(prev => [...prev, nouvelle])
    setForm(FORM_VIDE)
    setSaving(false)
  }

  async function supprimerFacture(id: string) {
    await fetch(`/api/factures/client/${id}`, { method: 'DELETE' })
    setFactures(prev => prev.filter(f => f.id !== id))
  }

  async function cloreLaFacturation() {
    if (factures.length === 0) { setError('Ajoutez au moins une facture avant de clore.'); return }
    setClosing(true)
    await fetch(`/api/ventes/${contratVente.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: 'clos' }),
    })
    setClosing(false)
    onSaved()
  }

  return (
    <Modal title="Factures client" onClose={onClose} size="lg">
      <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-2 text-sm text-amber-700 mb-5">
        <span className="font-semibold">{contratVente.numero_contrat}</span>
        {contratVente.agriculteur && <span> · {contratVente.agriculteur.nom}</span>}
      </div>

      {/* Liste des factures existantes */}
      {factures.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Factures saisies ({factures.length})
          </p>
          {factures.map(fac => (
            <div key={fac.id} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-4 py-2.5 text-sm">
              <div className="flex gap-4 flex-wrap">
                <span className="font-semibold text-green-800">{fac.numero_facture_logiciel}</span>
                {fac.montant_ht != null && <span className="text-gray-600">HT : {fac.montant_ht} €</span>}
                {fac.montant_ttc != null && <span className="text-gray-600">TTC : {fac.montant_ttc} €</span>}
                {fac.mode_paiement && <span className="text-gray-500">{MODES_PAIEMENT.find(m => m.value === fac.mode_paiement)?.label ?? fac.mode_paiement}</span>}
                {fac.date_paiement && <span className="text-gray-500">{formatDate(fac.date_paiement)}</span>}
              </div>
              <button onClick={() => supprimerFacture(fac.id)} className="text-gray-300 hover:text-red-500 transition-colors ml-3 flex-shrink-0">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire ajout */}
      <form onSubmit={ajouterFacture} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ajouter une facture</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">N° FAT (logiciel comptable) *</label>
            <input className="input" value={form.numero_facture_logiciel} onChange={f('numero_facture_logiciel')} placeholder="Ex: FAT-2026-0042" />
          </div>
          <div>
            <label className="label">Montant HT (€)</label>
            <input type="number" step="0.01" className="input" value={form.montant_ht} onChange={f('montant_ht')} />
          </div>
          <div>
            <label className="label">Montant TTC (€)</label>
            <input type="number" step="0.01" className="input" value={form.montant_ttc} onChange={f('montant_ttc')} />
          </div>
          <div>
            <label className="label">Mode de paiement</label>
            <select className="input" value={form.mode_paiement} onChange={f('mode_paiement')}>
              <option value="">— Non défini —</option>
              {MODES_PAIEMENT.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date de paiement</label>
            <input type="date" className="input" value={form.date_paiement} onChange={f('date_paiement')} />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={saving} className="btn-secondary w-full">
          {saving ? 'Ajout...' : '+ Ajouter cette facture'}
        </button>
      </form>

      {/* Bouton clore */}
      <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-4">
        <p className="text-xs text-gray-500">
          Une fois toutes les factures saisies, cliquez sur "Tout facturé" pour clore définitivement ce contrat de vente.
        </p>
        <button
          onClick={cloreLaFacturation}
          disabled={closing || factures.length === 0}
          className="flex-shrink-0 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40 transition-colors"
          style={{ backgroundColor: '#7B2820' }}
        >
          {closing ? 'Clôture...' : '✓ Tout facturé — Clore'}
        </button>
      </div>
    </Modal>
  )
}
