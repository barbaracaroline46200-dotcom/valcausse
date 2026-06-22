'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Pencil, ArrowLeft, Link2, CheckCircle, RotateCcw } from 'lucide-react'
import { formatTonnes, formatEurosParTonne, formatDate } from '@/lib/annee-agricole'
import { BadgeStatut } from '@/components/ui/Badge'
import { useAdmin } from '@/components/ui/AdminProvider'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import CalendrierContrat from '@/components/ui/CalendrierContrat'

export default function VenteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isAdmin } = useAdmin()
  const [vente, setVente] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [showRelierContrat, setShowRelierContrat] = useState(false)

  function reload() {
    fetch(`/api/ventes/${id}`).then(r => r.json()).then(v => { setVente(v); setLoading(false) })
  }

  useEffect(() => { reload() }, [id])

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" size={32} /></div>
  if (!vente || vente.error) return <div className="p-8 text-red-600">Contrat de vente introuvable.</div>

  const livraisons = vente.livraisons ?? []
  const qteLivree = livraisons.filter((l: any) => l.type === 'realisee').reduce((s: number, l: any) => s + (l.quantite_reelle ?? 0), 0)
  const reliquat = (vente.quantite ?? 0) - qteLivree

  return (
    <div className="space-y-6 pb-10">
      {/* Retour */}
      <div className="flex items-center gap-3">
        <Link href="/ventes" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Contrats de vente
        </Link>
      </div>

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold" style={{ color: '#7B2820' }}>{vente.numero_contrat}</h1>
              <BadgeStatut statut={vente.statut} />
            </div>
            <p className="text-gray-500 text-sm">Contrat de vente · {[vente.agriculteur?.civilite, vente.agriculteur?.nom].filter(Boolean).join(' ') || '—'}</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setShowRelierContrat(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
                <Link2 size={15} /> Relier à un autre contrat
              </button>
              {vente.statut === 'en_cours' ? (
                <button
                  onClick={async () => {
                    if (!confirm('Clore ce contrat de vente ?')) return
                    await fetch(`/api/ventes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut: 'clos' }) })
                    reload()
                  }}
                  className="btn-secondary flex items-center gap-1.5 text-sm text-green-700 border-green-200 hover:bg-green-50"
                >
                  <CheckCircle size={15} /> Clore
                </button>
              ) : (
                <button
                  onClick={async () => {
                    if (!confirm('Réouvrir ce contrat de vente ?')) return
                    await fetch(`/api/ventes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut: 'en_cours' }) })
                    reload()
                  }}
                  className="btn-secondary flex items-center gap-1.5 text-sm"
                >
                  <RotateCcw size={15} /> Réouvrir
                </button>
              )}
              <button onClick={() => setShowEdit(true)} className="btn-primary flex items-center gap-1.5 text-sm">
                <Pencil size={15} /> Modifier
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {[
            { label: 'Agriculteur', value: [vente.agriculteur?.civilite, vente.agriculteur?.nom].filter(Boolean).join(' ') || '—' ?? '—' },
            { label: 'Produit', value: vente.produit?.nom ?? '—' },
            { label: 'Quantité', value: formatTonnes(vente.quantite) },
            { label: 'Prix vente', value: formatEurosParTonne(vente.prix_vente) },
            ...(vente.date_debut ? [{ label: 'Date début', value: formatDate(vente.date_debut) }] : []),
            ...(vente.date_fin ? [{ label: 'Date fin', value: formatDate(vente.date_fin) }] : []),
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className="font-semibold text-gray-800">{value}</p>
            </div>
          ))}
        </div>

        {vente.notes && (
          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2 text-sm text-amber-700">
            📝 {vente.notes}
          </div>
        )}
      </div>

      {/* Contrat d'achat lié */}
      <div className="card">
        <h2 className="font-bold text-sm mb-3" style={{ color: '#7B2820' }}>Contrat d'achat lié</h2>
        {vente.contrat_achat ? (
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
            <div>
              <Link href={`/contrats/${vente.contrat_achat.id}`} className="font-semibold text-green-700 hover:underline">
                {vente.contrat_achat.numero_contrat}
              </Link>
              <span className="ml-2 text-sm text-gray-500">
                {vente.contrat_achat.fournisseur?.nom} · {vente.contrat_achat.produit?.nom} · {vente.contrat_achat.famille}
              </span>
            </div>
            {isAdmin && (
              <button onClick={() => setShowRelierContrat(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Link2 size={13} /> Changer
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400 italic">Aucun contrat d'achat lié (départ silo)</span>
            {isAdmin && (
              <button onClick={() => setShowRelierContrat(true)} className="btn-secondary text-xs">
                <Link2 size={13} /> Lier un contrat
              </button>
            )}
          </div>
        )}
      </div>

      {/* Calendrier */}
      {livraisons.length > 0 && (
        <CalendrierContrat livraisons={livraisons} />
      )}

      {/* Avancement livraisons */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm" style={{ color: '#7B2820' }}>Livraisons</h2>
          <div className="text-sm text-gray-500">
            <span className="font-semibold text-green-700">{formatTonnes(qteLivree)}</span> livrées
            {reliquat > 0 && <span className="ml-2 text-orange-600 font-semibold">· {formatTonnes(reliquat)} restantes</span>}
          </div>
        </div>
        {livraisons.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucune livraison</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Statut', 'Mois prévu', 'Date / Semaine', 'Enlèvement', 'Destination', 'Tonnes', 'CMR'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {livraisons.map((l: any) => (
                <tr key={l.id} className="table-row">
                  <td className="table-cell">
                    {l.type === 'realisee'
                      ? <span className="badge-clos text-xs">Réalisée</span>
                      : <span className="badge-en_cours text-xs">Planifiée</span>}
                  </td>
                  <td className="table-cell text-sm">{l.mois_prevu ? new Date(l.mois_prevu).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '—'}</td>
                  <td className="table-cell text-sm">
                    {l.date_reelle ? formatDate(l.date_reelle) : l.date_prevue ? formatDate(l.date_prevue) : l.semaine_prevue ?? '—'}
                  </td>
                  <td className="table-cell text-sm">{l.ville_chargement ?? '—'}</td>
                  <td className="table-cell text-sm">{l.ville_destination ?? '—'}</td>
                  <td className="table-cell font-semibold">{formatTonnes(l.type === 'realisee' ? l.quantite_reelle : l.quantite_prevue)}</td>
                  <td className="table-cell">
                    {l.type === 'realisee'
                      ? l.numero_lettre_voiture
                        ? <span className="badge-clos text-xs">{l.numero_lettre_voiture}</span>
                        : <span className="badge-alerte text-xs">Manquant</span>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showEdit && (
        <EditVenteModal vente={vente} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); reload() }} />
      )}
      {showRelierContrat && (
        <RelierContratModal vente={vente} onClose={() => setShowRelierContrat(false)} onSaved={() => { setShowRelierContrat(false); reload() }} />
      )}
    </div>
  )
}

// Modal modification contrat de vente
function EditVenteModal({ vente, onClose, onSaved }: { vente: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    numero_contrat: vente.numero_contrat ?? '',
    prix_vente: String(vente.prix_vente ?? ''),
    quantite: String(vente.quantite ?? ''),
    statut: vente.statut ?? 'en_cours',
    notes: vente.notes ?? '',
    date_debut: vente.date_debut ?? '',
    date_fin: vente.date_fin ?? '',
  })
  const [agriculteurs, setAgriculteurs] = useState<any[]>([])
  const [agriculteurId, setAgriculteurId] = useState(vente.agriculteur_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/referentiels/agriculteurs').then(r => r.json()).then(setAgriculteurs)
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/ventes/${vente.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero_contrat: form.numero_contrat,
        agriculteur_id: agriculteurId,
        prix_vente: parseFloat(form.prix_vente),
        quantite: parseFloat(form.quantite),
        statut: form.statut,
        notes: form.notes || null,
        date_debut: form.date_debut || null,
        date_fin: form.date_fin || null,
      }),
    })
    if (res.ok) { onSaved() } else { const d = await res.json(); setError(d.error ?? 'Erreur') }
    setSaving(false)
  }

  return (
    <Modal title="Modifier le contrat de vente" onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">N° contrat *</label>
            <input className="input" value={form.numero_contrat} onChange={e => setForm(p => ({ ...p, numero_contrat: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Agriculteur *</label>
            <select className="input" value={agriculteurId} onChange={e => setAgriculteurId(e.target.value)} required>
              <option value="">Choisir...</option>
              {agriculteurs.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Prix vente (€/t) *</label>
            <input type="number" step="0.01" className="input" value={form.prix_vente} onChange={e => setForm(p => ({ ...p, prix_vente: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Quantité (t) *</label>
            <input type="number" step="0.001" className="input" value={form.quantite} onChange={e => setForm(p => ({ ...p, quantite: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Statut</label>
            <select className="input" value={form.statut} onChange={e => setForm(p => ({ ...p, statut: e.target.value }))}>
              <option value="en_cours">En cours</option>
              <option value="clos">Clos</option>
              <option value="annule">Annulé</option>
            </select>
          </div>
          <div>
            <label className="label">Date début contrat</label>
            <input type="date" className="input" value={form.date_debut} onChange={e => setForm(p => ({ ...p, date_debut: e.target.value }))} />
          </div>
          <div>
            <label className="label">Date fin contrat</label>
            <input type="date" className="input" value={form.date_fin} onChange={e => setForm(p => ({ ...p, date_fin: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
        </div>
      </form>
    </Modal>
  )
}

// Modal relier à un autre contrat d'achat
function RelierContratModal({ vente, onClose, onSaved }: { vente: any; onClose: () => void; onSaved: () => void }) {
  const [contrats, setContrats] = useState<any[]>([])
  const [contratId, setContratId] = useState(vente.contrat_achat_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/contrats').then(r => r.json()).then(setContrats)
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/ventes/${vente.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contrat_achat_id: contratId || null }),
    })
    if (res.ok) { onSaved() } else { const d = await res.json(); setError(d.error ?? 'Erreur') }
    setSaving(false)
  }

  return (
    <Modal title="Relier à un contrat d'achat" onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-sm text-blue-700 mb-2">
          Contrat de vente : <strong>{vente.numero_contrat}</strong> · {[vente.agriculteur?.civilite, vente.agriculteur?.nom].filter(Boolean).join(' ') || '—'}
        </div>
        <div>
          <label className="label">Contrat d'achat à lier</label>
          <select className="input" value={contratId} onChange={e => setContratId(e.target.value)}>
            <option value="">— Aucun (départ silo) —</option>
            {contrats.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.numero_contrat} · {c.produit?.nom} · {c.fournisseur?.nom} ({c.famille})
              </option>
            ))}
          </select>
          {contratId && contratId !== vente.contrat_achat_id && (
            <p className="text-xs text-orange-600 mt-1">⚠️ Ce changement modifiera le lien de toutes les livraisons associées à ce contrat de vente.</p>
          )}
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Enregistrement...' : 'Enregistrer le lien'}</button>
        </div>
      </form>
    </Modal>
  )
}
