'use client'
import { useEffect, useState, useMemo } from 'react'
import { Loader2, Plus, Trash2, Search, Trophy, Edit2, Check, X, Truck } from 'lucide-react'
import { formatEurosParTonne } from '@/lib/annee-agricole'
import { useAdmin } from '@/components/ui/AdminProvider'

export default function TarifsTransportPage() {
  const { isAdmin } = useAdmin()
  const [tarifs, setTarifs] = useState<any[]>([])
  const [transporteurs, setTransporteurs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Comparateur
  const [compA, setCompA] = useState('')
  const [compB, setCompB] = useState('')

  // Formulaire ajout
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ transporteur_id: '', lieu_chargement: '', lieu_destination: '', prix_par_tonne: '', notes: '' })
  const [saving, setSaving] = useState(false)

  // Édition inline
  const [editId, setEditId] = useState<string | null>(null)
  const [editPrix, setEditPrix] = useState('')

  function charger() {
    Promise.all([
      fetch(`/api/tarifs-transport?t=${Date.now()}`).then(r => r.json()),
      fetch('/api/referentiels/transporteurs').then(r => r.json()),
    ]).then(([t, tr]) => {
      setTarifs(t ?? [])
      setTransporteurs(tr ?? [])
      setLoading(false)
    })
  }

  useEffect(() => { charger() }, [])

  // Lieux uniques (chargement + destination confondus pour l'autocomplete)
  const lieuxChargement = useMemo(() => [...new Set(tarifs.map((t: any) => t.lieu_chargement))].sort(), [tarifs])
  const lieuxDestination = useMemo(() => [...new Set(tarifs.map((t: any) => t.lieu_destination))].sort(), [tarifs])

  // Résultats comparateur
  const resultats = useMemo(() => {
    if (!compA.trim() || !compB.trim()) return []
    const a = compA.trim().toLowerCase()
    const b = compB.trim().toLowerCase()
    return tarifs
      .filter(t =>
        t.lieu_chargement.toLowerCase().includes(a) &&
        t.lieu_destination.toLowerCase().includes(b)
      )
      .sort((x, y) => x.prix_par_tonne - y.prix_par_tonne)
  }, [tarifs, compA, compB])

  async function ajouterTarif(e: React.FormEvent) {
    e.preventDefault()
    if (!form.transporteur_id || !form.lieu_chargement || !form.lieu_destination || !form.prix_par_tonne) return
    setSaving(true)
    await fetch('/api/tarifs-transport', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transporteur_id: form.transporteur_id,
        lieu_chargement: form.lieu_chargement.trim(),
        lieu_destination: form.lieu_destination.trim(),
        prix_par_tonne: parseFloat(form.prix_par_tonne),
        notes: form.notes.trim() || null,
      }),
    })
    setForm({ transporteur_id: '', lieu_chargement: '', lieu_destination: '', prix_par_tonne: '', notes: '' })
    setShowForm(false)
    setSaving(false)
    charger()
  }

  async function supprimerTarif(id: string) {
    if (!confirm('Supprimer ce tarif ?')) return
    await fetch(`/api/tarifs-transport/${id}`, { method: 'DELETE' })
    charger()
  }

  async function sauvegarderPrix(id: string) {
    const prix = parseFloat(editPrix)
    if (!prix || prix <= 0) return
    await fetch(`/api/tarifs-transport/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prix_par_tonne: prix }),
    })
    setEditId(null)
    charger()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" size={32} style={{ color: '#7B2820' }} /></div>

  return (
    <div className="space-y-6 pb-10">

      {/* Titre */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#7B2820' }}>
            <Truck size={22} style={{ color: '#C8941A' }} />
            Tarifs transport
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Grille tarifaire par transporteur et par trajet — comparaison des prix au départ</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(v => !v)} className="btn-primary">
            <Plus size={16} /> Ajouter un tarif
          </button>
        )}
      </div>

      {/* Formulaire ajout */}
      {showForm && isAdmin && (
        <form onSubmit={ajouterTarif} className="card space-y-4 border-2" style={{ borderColor: '#e4b5ad' }}>
          <h2 className="font-bold text-sm" style={{ color: '#7B2820' }}>Nouveau tarif</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="label">Transporteur *</label>
              <select className="input" value={form.transporteur_id} onChange={e => setForm(f => ({ ...f, transporteur_id: e.target.value }))} required>
                <option value="">Choisir…</option>
                {transporteurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Lieu d'enlèvement *</label>
              <input
                list="lieux-chargement"
                className="input"
                placeholder="ex. Gourdon"
                value={form.lieu_chargement}
                onChange={e => setForm(f => ({ ...f, lieu_chargement: e.target.value }))}
                required
              />
              <datalist id="lieux-chargement">
                {lieuxChargement.map(l => <option key={l} value={l} />)}
              </datalist>
            </div>
            <div>
              <label className="label">Lieu de livraison *</label>
              <input
                list="lieux-destination"
                className="input"
                placeholder="ex. Bordeaux"
                value={form.lieu_destination}
                onChange={e => setForm(f => ({ ...f, lieu_destination: e.target.value }))}
                required
              />
              <datalist id="lieux-destination">
                {lieuxDestination.map(l => <option key={l} value={l} />)}
              </datalist>
            </div>
            <div>
              <label className="label">Prix €/t *</label>
              <div className="relative">
                <input
                  type="number" step="0.01" min="0"
                  className="input pr-10"
                  placeholder="12.50"
                  value={form.prix_par_tonne}
                  onChange={e => setForm(f => ({ ...f, prix_par_tonne: e.target.value }))}
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€/t</span>
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <input
                className="input"
                placeholder="Optionnel"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Enregistrer
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
          </div>
        </form>
      )}

      {/* ── Comparateur ── */}
      <div className="card space-y-4">
        <h2 className="font-bold flex items-center gap-2 text-gray-800">
          <Search size={17} style={{ color: '#C8941A' }} />
          Comparer les transporteurs sur un trajet
        </h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label text-xs">Lieu d'enlèvement</label>
            <input
              list="comp-chargement"
              className="input w-48"
              placeholder="ex. Gourdon"
              value={compA}
              onChange={e => setCompA(e.target.value)}
            />
            <datalist id="comp-chargement">
              {lieuxChargement.map(l => <option key={l} value={l} />)}
            </datalist>
          </div>
          <span className="text-gray-400 text-lg pb-1">→</span>
          <div>
            <label className="label text-xs">Lieu de livraison</label>
            <input
              list="comp-destination"
              className="input w-48"
              placeholder="ex. Bordeaux"
              value={compB}
              onChange={e => setCompB(e.target.value)}
            />
            <datalist id="comp-destination">
              {lieuxDestination.map(l => <option key={l} value={l} />)}
            </datalist>
          </div>
          {(compA || compB) && (
            <button onClick={() => { setCompA(''); setCompB('') }} className="btn-secondary pb-2 self-end">
              <X size={14} /> Effacer
            </button>
          )}
        </div>

        {compA && compB && (
          resultats.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">Aucun tarif trouvé pour ce trajet. Ajoutez-en un avec le bouton ci-dessus.</p>
          ) : (
            <div className="space-y-2">
              {resultats.map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl border"
                  style={{
                    backgroundColor: i === 0 ? '#f0fdf4' : '#fafaf8',
                    borderColor: i === 0 ? '#bbf7d0' : '#ede9e3',
                  }}
                >
                  {i === 0 && <Trophy size={18} className="text-green-600 flex-shrink-0" />}
                  {i > 0 && <span className="w-[18px] text-center text-sm font-bold text-gray-400 flex-shrink-0">{i + 1}</span>}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800">{t.transporteur?.nom}</p>
                    <p className="text-xs text-gray-500">{t.lieu_chargement} → {t.lieu_destination}</p>
                    {t.notes && <p className="text-xs text-gray-400 italic mt-0.5">{t.notes}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-lg font-bold ${i === 0 ? 'text-green-700' : 'text-gray-700'}`}>
                      {formatEurosParTonne(t.prix_par_tonne)}
                    </p>
                    {i === 0 && <p className="text-xs text-green-600 font-medium">Moins cher</p>}
                    {i > 0 && resultats[0] && (
                      <p className="text-xs text-gray-400">
                        +{formatEurosParTonne(t.prix_par_tonne - resultats[0].prix_par_tonne)}
                      </p>
                    )}
                  </div>
                  {t.transporteur?.telephone && (
                    <a href={`tel:${t.transporteur.telephone}`} className="text-xs text-blue-600 hover:underline flex-shrink-0 hidden sm:block">
                      📞 {t.transporteur.telephone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )
        )}
        {(!compA || !compB) && (
          <p className="text-sm text-gray-400">Renseignez un lieu d'enlèvement et un lieu de livraison pour comparer les prix.</p>
        )}
      </div>

      {/* ── Grille complète des tarifs ── */}
      <div className="card-section overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: '#fdf5f3' }}>
          <h2 className="font-bold text-gray-800">Tous les tarifs ({tarifs.length})</h2>
        </div>
        {tarifs.length === 0 ? (
          <p className="px-5 py-10 text-center text-gray-400 text-sm">
            Aucun tarif enregistré. Cliquez sur "Ajouter un tarif" pour commencer.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50">
                <tr>
                  {['Transporteur', 'Enlèvement', 'Livraison', 'Prix €/t', 'Notes', ...(isAdmin ? [''] : [])].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tarifs.map(t => (
                  <tr key={t.id} className="table-row">
                    <td className="table-cell font-semibold">{t.transporteur?.nom ?? '—'}</td>
                    <td className="table-cell">{t.lieu_chargement}</td>
                    <td className="table-cell">{t.lieu_destination}</td>
                    <td className="table-cell">
                      {editId === t.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number" step="0.01" min="0"
                            value={editPrix}
                            onChange={e => setEditPrix(e.target.value)}
                            className="input w-24 py-1 text-sm"
                            autoFocus
                          />
                          <button onClick={() => sauvegarderPrix(t.id)} className="text-green-600 hover:text-green-700"><Check size={15} /></button>
                          <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600"><X size={15} /></button>
                        </div>
                      ) : (
                        <span
                          className="font-bold"
                          style={{ color: '#7B2820' }}
                          onClick={() => isAdmin ? (setEditId(t.id), setEditPrix(String(t.prix_par_tonne))) : undefined}
                          title={isAdmin ? 'Cliquer pour modifier' : undefined}
                        >
                          {formatEurosParTonne(t.prix_par_tonne)}
                        </span>
                      )}
                    </td>
                    <td className="table-cell text-xs text-gray-500">{t.notes ?? '—'}</td>
                    {isAdmin && (
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditId(t.id); setEditPrix(String(t.prix_par_tonne)) }}
                            className="text-gray-400 hover:text-gray-700"
                            title="Modifier le prix"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => supprimerTarif(t.id)}
                            className="text-gray-300 hover:text-red-500"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
