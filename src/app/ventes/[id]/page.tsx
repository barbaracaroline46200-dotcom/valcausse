'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Pencil, ArrowLeft, Link2, CheckCircle, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { formatTonnes, formatEurosParTonne, formatDate } from '@/lib/annee-agricole'
import { BadgeStatut, BadgeAnnee } from '@/components/ui/Badge'
import { useAdmin } from '@/components/ui/AdminProvider'
import { contratSyntheticFromVente } from '@/lib/utils'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import CalendrierContrat from '@/components/ui/CalendrierContrat'
import AjouterLivraisonSiloModal from '@/components/livraisons/AjouterLivraisonSiloModal'
import RealiserLivraisonModal from '@/components/livraisons/RealiserLivraisonModal'
import ModifierLivraisonModal from '@/components/livraisons/ModifierLivraisonModal'
import AvancementLivraison from '@/components/livraisons/AvancementLivraison'
import ProgressBar from '@/components/ui/ProgressBar'

export default function VenteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { isAdmin } = useAdmin()
  const [vente, setVente] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [showRelierContrat, setShowRelierContrat] = useState(false)
  const [showAjoutLiv, setShowAjoutLiv] = useState(false)
  const [realiserLiv, setRealiserLiv] = useState<any>(null)
  const [modifierLiv, setModifierLiv] = useState<any>(null)

  function reload() {
    fetch(`/api/ventes/${id}`).then(r => r.json()).then(v => { setVente(v); setLoading(false) })
  }

  async function supprimerLivraison(livId: string) {
    if (!confirm('Supprimer cette livraison ?')) return
    await fetch(`/api/livraisons/${livId}`, { method: 'DELETE' })
    reload()
  }

  useEffect(() => { reload() }, [id])

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" size={32} /></div>
  if (!vente || vente.error) return <div className="p-8 text-red-600">Contrat de vente introuvable.</div>

  const livraisons = vente.livraisons ?? []
  const qteLivree = livraisons.filter((l: any) => l.type === 'realisee').reduce((s: number, l: any) => s + (l.quantite_reelle ?? 0), 0)
  const reliquat = (vente.quantite ?? 0) - qteLivree
  const liens = vente.liens ?? []
  const totalLie = liens.reduce((s: number, l: any) => s + (l.quantite ?? 0), 0)
  const nonAffecte = (vente.quantite ?? 0) - totalLie

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
              <BadgeAnnee dateStr={vente.date_debut} />
            </div>
            <p className="text-gray-500 text-sm">Contrat de vente · {[vente.agriculteur?.civilite, vente.agriculteur?.nom].filter(Boolean).join(' ') || '—'}</p>
          </div>
          {isAdmin && (
            <div className="flex gap-2 flex-wrap">
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

      {/* Avancement */}
      <div className="card space-y-4">
        <h2 className="font-bold text-sm" style={{ color: '#7B2820' }}>Avancement</h2>
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Contrat total</div>
          <div className="text-3xl font-extrabold text-gray-900">{formatTonnes(vente.quantite)}</div>
          <div className="mt-2 text-sm text-gray-500">dont <span className="font-semibold text-gray-700">{formatTonnes(qteLivree)}</span> livrées</div>
        </div>
        <ProgressBar value={qteLivree} total={vente.quantite ?? 0} />
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-orange-600">{formatTonnes(reliquat)}</div>
          <div className="text-xs text-orange-700 font-medium">Reliquat à livrer</div>
        </div>
      </div>

      {/* Contrats d'achat liés */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm" style={{ color: '#7B2820' }}>Contrat(s) d'achat lié(s)</h2>
          {isAdmin && (
            <button onClick={() => setShowRelierContrat(true)} className="btn-secondary text-xs">
              <Link2 size={13} /> Lier un contrat d'achat
            </button>
          )}
        </div>
        {liens.length === 0 ? (
          <span className="text-sm text-gray-400 italic">Aucun contrat d'achat lié (départ silo)</span>
        ) : (
          <div className="space-y-2">
            {liens.map((l: any) => (
              <div key={l.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <div>
                  <Link href={`/contrats/${l.contrat_achat.id}`} className="font-semibold text-green-700 hover:underline">
                    {l.contrat_achat.numero_contrat}
                  </Link>
                  <span className="ml-2 text-sm text-gray-500">
                    {l.contrat_achat.fournisseur?.nom} · {l.contrat_achat.produit?.nom} · {l.contrat_achat.famille}
                  </span>
                  <span className="ml-2 text-sm font-semibold text-gray-700">{formatTonnes(l.quantite)}</span>
                </div>
                {isAdmin && (
                  <button
                    onClick={async () => {
                      if (!confirm(`Délier ce contrat de vente du contrat d'achat "${l.contrat_achat.numero_contrat}" ?`)) return
                      await fetch(`/api/ventes/${id}/liens?contrat_achat_id=${l.contrat_achat.id}`, { method: 'DELETE' })
                      reload()
                    }}
                    className="text-xs text-orange-600 hover:underline"
                  >
                    Délier
                  </button>
                )}
              </div>
            ))}
            {nonAffecte > 0.001 && (
              <p className="text-xs text-gray-400">
                Reliquat non affecté à un contrat d'achat : <span className="font-semibold text-gray-600">{formatTonnes(nonAffecte)}</span>
              </p>
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
          <div className="flex items-center gap-4">
            {isAdmin && liens.length === 0 && (
              <button onClick={() => setShowAjoutLiv(true)} className="btn-primary text-xs">
                <Plus size={14} /> Ajouter livraison
              </button>
            )}
          </div>
        </div>
        {liens.length === 0 && (
          <p className="text-xs text-gray-400 mb-3">
            Vente directe départ silo — les livraisons se gèrent ici (pas de contrat d'achat lié).
          </p>
        )}
        {livraisons.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aucune livraison</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Statut', 'Mois prévu', 'Date / Semaine', 'Enlèvement', 'Destination', 'Transporteur', 'Tonnes', 'CMR', ...(liens.length > 0 ? [] : ['Actions'])].map(h => (
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
                    {l.type === 'realisee'
                      ? formatDate(l.date_reelle)
                      : <AvancementLivraison livraison={l} />}
                  </td>
                  <td className="table-cell text-sm">{l.ville_chargement ?? '—'}</td>
                  <td className="table-cell text-sm">{l.ville_destination ?? '—'}</td>
                  <td className="table-cell text-sm">{l.transporteur?.nom ?? '—'}</td>
                  <td className="table-cell font-semibold">{formatTonnes(l.type === 'realisee' ? l.quantite_reelle : l.quantite_prevue)}</td>
                  <td className="table-cell">
                    {l.type === 'realisee'
                      ? l.numero_lettre_voiture
                        ? <span className="badge-clos text-xs">{l.numero_lettre_voiture}</span>
                        : <span className="badge-alerte text-xs">Manquant</span>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  {liens.length === 0 && (
                    <td className="table-cell">
                      {isAdmin && (
                        <div className="flex gap-1 flex-wrap">
                          {l.type === 'planifiee' && (
                            <>
                              <button onClick={() => setRealiserLiv(l)} className="btn-primary text-xs py-1 px-2">
                                Réaliser
                              </button>
                              <button onClick={() => setModifierLiv(l)} className="btn-secondary text-xs py-1 px-2">
                                <Pencil size={12} />
                              </button>
                            </>
                          )}
                          <button onClick={() => supprimerLivraison(l.id)} className="btn-danger text-xs py-1 px-2">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
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
      {showAjoutLiv && (
        <AjouterLivraisonSiloModal vente={vente} onClose={() => setShowAjoutLiv(false)} onSaved={() => { setShowAjoutLiv(false); reload() }} />
      )}
      {realiserLiv && (
        <RealiserLivraisonModal
          livraison={realiserLiv}
          contrat={contratSyntheticFromVente(vente)}
          onClose={() => setRealiserLiv(null)}
          onSaved={() => { setRealiserLiv(null); reload() }}
        />
      )}
      {modifierLiv && (
        <ModifierLivraisonModal
          livraison={modifierLiv}
          contrat={contratSyntheticFromVente(vente)}
          onClose={() => setModifierLiv(null)}
          onSaved={() => { setModifierLiv(null); reload() }}
        />
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
  const [contratId, setContratId] = useState('')
  const liensExistants = vente.liens ?? []
  const totalLie = liensExistants.reduce((s: number, l: any) => s + (l.quantite ?? 0), 0)
  const [quantite, setQuantite] = useState(String(Math.max(0, (vente.quantite ?? 0) - totalLie)))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/contrats').then(r => r.json()).then(setContrats)
  }, [])

  const idsDejaLies = new Set(liensExistants.map((l: any) => l.contrat_achat.id))
  const contratsDisponibles = contrats.filter((c: any) => !idsDejaLies.has(c.id))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!contratId) return
    const qte = parseFloat(quantite)
    if (!qte || qte <= 0) { setError('Saisir une quantité valide.'); return }
    setSaving(true)
    const res = await fetch(`/api/ventes/${vente.id}/liens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contrat_achat_id: contratId, quantite: qte }),
    })
    if (res.ok) { onSaved() } else { const d = await res.json(); setError(d.error ?? 'Erreur') }
    setSaving(false)
  }

  return (
    <Modal title="Lier un contrat d'achat" onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-sm text-blue-700 mb-2">
          Contrat de vente : <strong>{vente.numero_contrat}</strong> · {[vente.agriculteur?.civilite, vente.agriculteur?.nom].filter(Boolean).join(' ') || '—'}
          {' · '}reliquat non affecté : <strong>{Math.max(0, (vente.quantite ?? 0) - totalLie).toLocaleString('fr-FR')} t</strong>
        </div>
        <div>
          <label className="label">Contrat d'achat à lier</label>
          <select className="input" value={contratId} onChange={e => setContratId(e.target.value)} required>
            <option value="">Choisir...</option>
            {contratsDisponibles.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.numero_contrat} · {c.produit?.nom} · {c.fournisseur?.nom} ({c.famille})
              </option>
            ))}
          </select>
          {contratsDisponibles.length === 0 && (
            <p className="text-sm text-gray-500 mt-1">Aucun autre contrat d'achat disponible.</p>
          )}
        </div>
        <div>
          <label className="label">Quantité à lier (t)</label>
          <input type="number" step="0.001" className="input" value={quantite} onChange={e => setQuantite(e.target.value)} required />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving || !contratId} className="btn-primary">{saving ? 'Enregistrement...' : 'Lier'}</button>
        </div>
      </form>
    </Modal>
  )
}
