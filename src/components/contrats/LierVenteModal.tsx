'use client'
import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'

interface Props {
  contratAchatId: string
  onClose: () => void
  onSaved: () => void
}

export default function LierVenteModal({ contratAchatId, onClose, onSaved }: Props) {
  const [ventes, setVentes] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Contrats de vente sans contrat d'achat lié
    fetch('/api/ventes?contrat_achat_id=null').then(r => r.json()).then(setVentes)
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    const res = await fetch(`/api/ventes/${selected}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contrat_achat_id: contratAchatId }),
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
          <label className="label">Contrat de vente (départ silo)</label>
          <select className="input" value={selected} onChange={e => setSelected(e.target.value)} required>
            <option value="">Choisir...</option>
            {ventes.map((v: any) => (
              <option key={v.id} value={v.id}>
                {v.numero_contrat} — {v.agriculteur?.nom} — {v.produit?.nom}
              </option>
            ))}
          </select>
          {ventes.length === 0 && (
            <p className="text-sm text-gray-500 mt-1">Aucun contrat de vente "départ silo" disponible.</p>
          )}
        </div>
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
