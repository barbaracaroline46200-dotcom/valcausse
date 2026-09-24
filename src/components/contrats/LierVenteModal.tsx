'use client'
import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { formatTonnes } from '@/lib/annee-agricole'

interface Props {
  contratAchatId: string
  onClose: () => void
  onSaved: () => void
}

export default function LierVenteModal({ contratAchatId, onClose, onSaved }: Props) {
  const [ventes, setVentes] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [quantite, setQuantite] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/ventes?statut=en_cours').then(r => r.json()).then(setVentes)
  }, [])

  function reliquatNonLie(v: any): number {
    const totalLie = (v.liens ?? []).reduce((s: number, l: any) => s + (l.quantite ?? 0), 0)
    return Math.max(0, (v.quantite ?? 0) - totalLie)
  }

  const venteSelectionnee = ventes.find((v: any) => v.id === selected)

  function onSelectVente(id: string) {
    setSelected(id)
    const v = ventes.find((x: any) => x.id === id)
    if (v) setQuantite(String(reliquatNonLie(v)))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    const qte = parseFloat(quantite)
    if (!qte || qte <= 0) { setError('Saisir une quantité valide.'); return }
    setSaving(true)
    const res = await fetch(`/api/ventes/${selected}/liens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contrat_achat_id: contratAchatId, quantite: qte }),
    })
    if (res.ok) { onSaved() } else {
      const d = await res.json()
      setError(d.error ?? 'Erreur')
    }
    setSaving(false)
  }

  return (
    <Modal title="Lier un contrat de vente existant" onClose={onClose} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Contrat de vente (en cours)</label>
          <select className="input" value={selected} onChange={e => onSelectVente(e.target.value)} required>
            <option value="">Choisir...</option>
            {ventes.map((v: any) => (
              <option key={v.id} value={v.id}>
                {v.numero_contrat} — {[v.agriculteur?.civilite, v.agriculteur?.nom].filter(Boolean).join(' ') || v.silo_nom || 'Silo'} — {v.produit?.nom} — reliquat à lier : {formatTonnes(reliquatNonLie(v))}
              </option>
            ))}
          </select>
          {ventes.length === 0 && (
            <p className="text-sm text-gray-500 mt-1">Aucun contrat de vente en cours disponible.</p>
          )}
        </div>
        {venteSelectionnee && (
          <div>
            <label className="label">Quantité à lier à ce contrat d'achat (t)</label>
            <input
              type="number" step="0.001" className="input" value={quantite}
              onChange={e => setQuantite(e.target.value)} required
            />
            <p className="text-xs text-gray-400 mt-1">
              Contrat de vente total : {formatTonnes(venteSelectionnee.quantite)} · reliquat non encore lié : {formatTonnes(reliquatNonLie(venteSelectionnee))}
            </p>
          </div>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving || !selected} className="btn-primary">
            {saving ? 'Enregistrement...' : 'Lier'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
