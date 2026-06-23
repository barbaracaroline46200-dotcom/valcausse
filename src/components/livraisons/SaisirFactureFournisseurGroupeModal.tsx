'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { formatDate, formatTonnes } from '@/lib/annee-agricole'

interface Props {
  livraisons: any[]
  onClose: () => void
  onSaved: () => void
}

const MODES_PAIEMENT = [
  { value: 'virement', label: 'Virement' },
  { value: 'prelevement', label: 'Prélèvement' },
  { value: 'lcr', label: 'LCR' },
]

export default function SaisirFactureFournisseurGroupeModal({ livraisons, onClose, onSaved }: Props) {
  // Détecter la famille depuis les livraisons sélectionnées
  const famille = livraisons[0]?.contrat_achat?.famille ?? 'negoce'
  const isAppro = famille === 'appro'
  const prefixe = isAppro ? 'FAF' : 'FAN'

  const fournisseurNom = livraisons[0]?.contrat_achat?.fournisseur?.nom ?? '—'
  const totalTonnes = livraisons.reduce((s, l) => s + (l.quantite_reelle ?? 0), 0)
  const totalAttendu = livraisons.reduce((s, l) => {
    const prix = l.contrat_achat?.prix_achat ?? 0
    return s + prix * (l.quantite_reelle ?? 0)
  }, 0)

  const [form, setForm] = useState({
    numero_facture_fournisseur: '',   // N° que le fournisseur met sur sa facture
    numero_piece_logiciel: '',        // N° FAN / FAF dans Atys
    date_facture: '',
    montant_ht: '',
    montant_ttc: '',
    mode_paiement: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function f(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.numero_facture_fournisseur.trim()) { setError('Le N° de facture fournisseur est obligatoire'); return }
    setSaving(true)
    setError('')

    // Créer la facture fournisseur
    const factureBody = {
      contrat_achat_id: livraisons[0].contrat_achat?.id,
      livraison_id: livraisons[0].id,
      numero_facture: form.numero_facture_fournisseur.trim(),
      numero_piece_logiciel: form.numero_piece_logiciel.trim() ? `${prefixe}${form.numero_piece_logiciel.trim()}` : null,
      prefixe,
      date_facture: form.date_facture || null,
      montant_ht: form.montant_ht ? parseFloat(form.montant_ht) : null,
      montant_ttc: form.montant_ttc ? parseFloat(form.montant_ttc) : null,
      mode_paiement: (!isAppro && form.mode_paiement) ? form.mode_paiement : null,
    }

    const res = await fetch('/api/factures/fournisseur', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(factureBody),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Erreur création facture')
      setSaving(false)
      return
    }

    const facture = await res.json()

    // Lier toutes les livraisons sélectionnées à cette facture
    await Promise.all(livraisons.map(l =>
      fetch(`/api/livraisons/${l.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facture_fournisseur_id: facture.id }),
      })
    ))

    onSaved()
  }

  return (
    <Modal title="Saisir la facture fournisseur" onClose={onClose} size="md">
      {/* Récap livraisons */}
      <div className="mb-5 rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {livraisons.length} livraison{livraisons.length > 1 ? 's' : ''} · {fournisseurNom}
          </span>
          <span className="text-xs font-bold text-gray-700">{formatTonnes(totalTonnes)} au total</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60 text-xs text-gray-400">
              <th className="px-4 py-1.5 text-left font-medium">Date</th>
              <th className="px-4 py-1.5 text-left font-medium">Produit</th>
              <th className="px-4 py-1.5 text-left font-medium">Destinataire</th>
              <th className="px-4 py-1.5 text-right font-medium">Tonnes</th>
              <th className="px-4 py-1.5 text-right font-medium">Prix achat</th>
              <th className="px-4 py-1.5 text-right font-medium">Montant attendu</th>
            </tr>
          </thead>
          <tbody>
            {livraisons.map(l => {
              const ca = l.contrat_achat
              const agri = ca?.contrats_vente?.find((v: any) => v.id === l.contrat_vente_id)?.agriculteur
              const prixAchat = ca?.prix_achat
              const montantAttendu = prixAchat != null ? prixAchat * (l.quantite_reelle ?? 0) : null
              return (
                <tr key={l.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-1.5 text-gray-500">{formatDate(l.date_reelle)}</td>
                  <td className="px-4 py-1.5">{ca?.produit?.nom ?? '—'}</td>
                  <td className="px-4 py-1.5 text-gray-500">{agri?.nom ?? ca?.numero_contrat ?? '—'}</td>
                  <td className="px-4 py-1.5 font-semibold text-right">{formatTonnes(l.quantite_reelle)}</td>
                  <td className="px-4 py-1.5 text-right text-gray-500 text-xs">{prixAchat != null ? `${prixAchat} €/t` : '—'}</td>
                  <td className="px-4 py-1.5 text-right font-semibold text-amber-700">{montantAttendu != null ? `${montantAttendu.toFixed(2)} €` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
          {totalAttendu > 0 && (
            <tfoot>
              <tr className="border-t-2 border-amber-200 bg-amber-50/50">
                <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-amber-800 uppercase tracking-wide">Total attendu</td>
                <td className="px-4 py-2 text-right font-bold text-gray-700">{formatTonnes(totalTonnes)}</td>
                <td className="px-4 py-2"></td>
                <td className="px-4 py-2 text-right font-bold text-amber-700 text-base">{totalAttendu.toFixed(2)} €</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">N° facture fournisseur *
              <span className="text-xs text-gray-400 font-normal ml-1">(numéro indiqué sur la facture reçue)</span>
            </label>
            <input className="input" value={form.numero_facture_fournisseur} onChange={f('numero_facture_fournisseur')}
              placeholder="Ex: 2026-FA-0042" autoFocus />
          </div>

          <div className="col-span-2">
            <label className="label">{isAppro ? 'N° FAF' : 'N° FAN'} dans Atys
              <span className="text-xs text-gray-400 font-normal ml-1">(optionnel — à saisir si disponible)</span>
            </label>
            <div className="flex gap-1 items-center">
              <span className="input w-16 text-center bg-gray-50 text-gray-500 font-mono text-sm flex items-center justify-center">{prefixe}</span>
              <input className="input flex-1" value={form.numero_piece_logiciel} onChange={f('numero_piece_logiciel')}
                placeholder="numéro dans logiciel compta" />
            </div>
          </div>

          {!isAppro && (
            <div>
              <label className="label">Date de facturation</label>
              <input type="date" className="input" value={form.date_facture} onChange={f('date_facture')} />
            </div>
          )}

          <div>
            <label className="label">Montant HT (€) *</label>
            <input type="number" step="0.01" className="input" value={form.montant_ht} onChange={f('montant_ht')} required />
            {form.montant_ht && totalAttendu > 0 && (() => {
              const saisi = parseFloat(form.montant_ht)
              const ecart = saisi - totalAttendu
              const pct = Math.abs(ecart / totalAttendu * 100)
              if (Math.abs(ecart) < 0.01) return <p className="text-xs text-green-600 mt-1 font-medium">✓ Correspond au montant attendu</p>
              return (
                <p className={`text-xs mt-1 font-medium ${ecart > 0 ? 'text-red-600' : 'text-orange-600'}`}>
                  {ecart > 0 ? '⚠ Facturé ' : '⚠ Facturé '}
                  <strong>{ecart > 0 ? '+' : ''}{ecart.toFixed(2)} €</strong> vs attendu {totalAttendu.toFixed(2)} € ({pct.toFixed(1)}%)
                </p>
              )
            })()}
          </div>
          <div>
            <label className="label">Montant TTC (€)</label>
            <input type="number" step="0.01" className="input" value={form.montant_ttc} onChange={f('montant_ttc')} />
          </div>

          {!isAppro && (
            <div>
              <label className="label">Mode de paiement</label>
              <select className="input" value={form.mode_paiement} onChange={f('mode_paiement')}>
                <option value="">— Non défini —</option>
                {MODES_PAIEMENT.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          )}
        </div>

        {isAppro && (
          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
            N° FAF, RF et date de paiement seront renseignés plus tard via la section RF.
          </p>
        )}

        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Enregistrement...' : `✓ Valider la facture`}
          </button>
        </div>
      </form>
    </Modal>
  )
}
