'use client'
import { useEffect, useState } from 'react'
import { BookOpen, Plus, Loader2, Users, Wheat, Truck, UserCheck, Package, Pencil } from 'lucide-react'
import { useAdmin } from '@/components/ui/AdminProvider'
import Modal from '@/components/ui/Modal'

type Tab = 'fournisseurs' | 'agriculteurs' | 'courtiers' | 'transporteurs' | 'produits'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'fournisseurs', label: 'Fournisseurs', icon: <Wheat size={16} /> },
  { key: 'agriculteurs', label: 'Agriculteurs', icon: <Users size={16} /> },
  { key: 'courtiers', label: 'Courtiers', icon: <UserCheck size={16} /> },
  { key: 'transporteurs', label: 'Transporteurs', icon: <Truck size={16} /> },
  { key: 'produits', label: 'Produits', icon: <Package size={16} /> },
]

const FIELDS: Record<Tab, Array<{ key: string; label: string; required?: boolean; type?: string; options?: any[] }>> = {
  fournisseurs: [
    { key: 'nom', label: 'Nom', required: true },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'adresse', label: 'Adresse' },
    { key: 'notes', label: 'Notes' },
  ],
  agriculteurs: [
    { key: 'civilite', label: 'Civilité (forme juridique)', type: 'select', options: [
      { value: 'EARL', label: 'EARL' },
      { value: 'GAEC', label: 'GAEC' },
      { value: 'SAS', label: 'SAS' },
      { value: 'SARL', label: 'SARL' },
      { value: 'SCEA', label: 'SCEA' },
      { value: 'GFA', label: 'GFA' },
      { value: 'GIE', label: 'GIE' },
      { value: 'SCL', label: 'SCL' },
      { value: 'SA', label: 'SA' },
      { value: 'Ferme', label: 'Ferme' },
      { value: 'M.', label: 'M.' },
      { value: 'Mme', label: 'Mme' },
    ]},
    { key: 'nom', label: 'Nom (sans civilité)', required: true },
    { key: 'adresse_livraison', label: 'Adresse livraison' },
    { key: 'ville_livraison', label: 'Ville livraison' },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'numero_client_logiciel', label: 'N° client Atys' },
    { key: 'notes', label: 'Notes' },
    { key: 'note_transport', label: 'Note transport (PDF)' },
  ],
  courtiers: [
    { key: 'nom', label: 'Nom', required: true },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'email', label: 'Email', type: 'email' },
  ],
  transporteurs: [
    { key: 'nom', label: 'Nom', required: true },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'email', label: 'Email', type: 'email' },
  ],
  produits: [
    { key: 'nom', label: 'Nom', required: true },
    { key: 'famille', label: 'Famille', required: true, type: 'select', options: [{ value: 'negoce', label: 'Négoce' }, { value: 'appro', label: 'Appro' }] },
  ],
}

const URLS: Record<Tab, string> = {
  fournisseurs: '/api/referentiels/fournisseurs',
  agriculteurs: '/api/referentiels/agriculteurs',
  courtiers: '/api/referentiels/courtiers',
  transporteurs: '/api/referentiels/transporteurs',
  produits: '/api/referentiels/produits',
}

export default function ReferentielsPage() {
  const { isAdmin } = useAdmin()
  const [tab, setTab] = useState<Tab>('fournisseurs')
  const [data, setData] = useState<Record<Tab, any[]>>({
    fournisseurs: [], agriculteurs: [], courtiers: [], transporteurs: [], produits: [],
  })
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)

  async function loadAll() {
    const [f, a, c, t, p] = await Promise.all([
      fetch('/api/referentiels/fournisseurs').then(r => r.json()),
      fetch('/api/referentiels/agriculteurs').then(r => r.json()),
      fetch('/api/referentiels/courtiers').then(r => r.json()),
      fetch('/api/referentiels/transporteurs').then(r => r.json()),
      fetch('/api/referentiels/produits').then(r => r.json()),
    ])
    setData({ fournisseurs: f, agriculteurs: a, courtiers: c, transporteurs: t, produits: p })
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
      <BookOpen size={48} className="text-gray-300" />
      <p className="text-gray-500 font-medium">Accès réservé aux administrateurs</p>
      <p className="text-sm text-gray-400">Connectez-vous en mode admin via la barre latérale</p>
    </div>
  )

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-green-600" size={32} /></div>

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#7B2820' }}>
          <BookOpen size={24} style={{ color: '#C8941A' }} />
          Référentiels
        </h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.icon}
            {t.label}
            <span className="text-xs text-gray-400 font-normal">({data[t.key].length})</span>
          </button>
        ))}
      </div>

      <div className="card-section overflow-hidden">
        <div className="overflow-x-auto">
          {tab === 'fournisseurs' && <FournisseursList data={data.fournisseurs} onEdit={setEditing} />}
          {tab === 'agriculteurs' && <AgriculteursList data={data.agriculteurs} onEdit={setEditing} />}
          {tab === 'courtiers' && <CortiersList data={data.courtiers} onEdit={setEditing} />}
          {tab === 'transporteurs' && <TransporteursList data={data.transporteurs} onEdit={setEditing} />}
          {tab === 'produits' && <ProduitsList data={data.produits} onEdit={setEditing} />}
        </div>
      </div>

      {showAdd && (
        <EntryModal tab={tab} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); loadAll() }} />
      )}
      {editing && (
        <EntryModal tab={tab} initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); loadAll() }} />
      )}
    </div>
  )
}

function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
      <Pencil size={14} />
    </button>
  )
}

function FournisseursList({ data, onEdit }: { data: any[]; onEdit: (item: any) => void }) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50/50">
        <tr>{['Nom', 'Téléphone', 'Email', 'Points de chargement', ''].map((h, i) => <th key={i} className="table-header">{h}</th>)}</tr>
      </thead>
      <tbody>
        {data.map(f => (
          <tr key={f.id} className="table-row">
            <td className="table-cell font-medium">{f.nom}</td>
            <td className="table-cell text-gray-500">{f.telephone ?? '—'}</td>
            <td className="table-cell text-gray-500">{f.email ?? '—'}</td>
            <td className="table-cell">
              {(f.points_chargement ?? []).map((p: any) => (
                <div key={p.id} className="text-xs text-gray-600">{p.libelle} — {p.ville}</div>
              ))}
            </td>
            <td className="table-cell w-10"><EditBtn onClick={() => onEdit(f)} /></td>
          </tr>
        ))}
        {data.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Aucun fournisseur</td></tr>}
      </tbody>
    </table>
  )
}

function AgriculteursList({ data, onEdit }: { data: any[]; onEdit: (item: any) => void }) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50/50">
        <tr>{['Civilité', 'Nom', 'Ville livraison', 'Téléphone', 'Email', 'N° client', ''].map((h, i) => <th key={i} className="table-header">{h}</th>)}</tr>
      </thead>
      <tbody>
        {data.map(a => (
          <tr key={a.id} className="table-row">
            <td className="table-cell text-gray-500 text-sm">{a.civilite ?? '—'}</td>
            <td className="table-cell font-medium">{a.nom}</td>
            <td className="table-cell">{a.ville_livraison ?? '—'}</td>
            <td className="table-cell text-gray-500">{a.telephone ?? '—'}</td>
            <td className="table-cell text-gray-500">{a.email ?? '—'}</td>
            <td className="table-cell text-xs text-gray-400">{a.numero_client_logiciel ?? '—'}</td>
            <td className="table-cell w-10"><EditBtn onClick={() => onEdit(a)} /></td>
          </tr>
        ))}
        {data.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Aucun agriculteur</td></tr>}
      </tbody>
    </table>
  )
}

function CortiersList({ data, onEdit }: { data: any[]; onEdit: (item: any) => void }) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50/50">
        <tr>{['Nom', 'Téléphone', 'Email', ''].map((h, i) => <th key={i} className="table-header">{h}</th>)}</tr>
      </thead>
      <tbody>
        {data.map(c => (
          <tr key={c.id} className="table-row">
            <td className="table-cell font-medium">{c.nom}</td>
            <td className="table-cell text-gray-500">{c.telephone ?? '—'}</td>
            <td className="table-cell text-gray-500">{c.email ?? '—'}</td>
            <td className="table-cell w-10"><EditBtn onClick={() => onEdit(c)} /></td>
          </tr>
        ))}
        {data.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Aucun courtier</td></tr>}
      </tbody>
    </table>
  )
}

function TransporteursList({ data, onEdit }: { data: any[]; onEdit: (item: any) => void }) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50/50">
        <tr>{['Nom', 'Téléphone', 'Email', ''].map((h, i) => <th key={i} className="table-header">{h}</th>)}</tr>
      </thead>
      <tbody>
        {data.map(t => (
          <tr key={t.id} className="table-row">
            <td className="table-cell font-medium">{t.nom}</td>
            <td className="table-cell text-gray-500">{t.telephone ?? '—'}</td>
            <td className="table-cell text-gray-500">{t.email ?? '—'}</td>
            <td className="table-cell w-10"><EditBtn onClick={() => onEdit(t)} /></td>
          </tr>
        ))}
        {data.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Aucun transporteur</td></tr>}
      </tbody>
    </table>
  )
}

function ProduitsList({ data, onEdit }: { data: any[]; onEdit: (item: any) => void }) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50/50">
        <tr>{['Nom', 'Famille', ''].map((h, i) => <th key={i} className="table-header">{h}</th>)}</tr>
      </thead>
      <tbody>
        {data.map(p => (
          <tr key={p.id} className="table-row">
            <td className="table-cell font-medium">{p.nom}</td>
            <td className="table-cell">
              <span className={p.famille === 'negoce' ? 'badge-negoce' : 'badge-appro'}>
                {p.famille === 'negoce' ? 'Négoce' : 'Appro'}
              </span>
            </td>
            <td className="table-cell w-10"><EditBtn onClick={() => onEdit(p)} /></td>
          </tr>
        ))}
        {data.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">Aucun produit</td></tr>}
      </tbody>
    </table>
  )
}

function EntryModal({ tab, initial, onClose, onSaved }: {
  tab: Tab; initial?: any; onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!initial
  const [form, setForm] = useState<Record<string, string>>(initial ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const titles: Record<Tab, string> = {
    fournisseurs: isEdit ? 'Modifier le fournisseur' : 'Ajouter un fournisseur',
    agriculteurs: isEdit ? 'Modifier l\'agriculteur' : 'Ajouter un agriculteur',
    courtiers: isEdit ? 'Modifier le courtier' : 'Ajouter un courtier',
    transporteurs: isEdit ? 'Modifier le transporteur' : 'Ajouter un transporteur',
    produits: isEdit ? 'Modifier le produit' : 'Ajouter un produit',
  }

  function f(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const url = isEdit ? `${URLS[tab]}/${initial.id}` : URLS[tab]
    const method = isEdit ? 'PATCH' : 'POST'
    const allowedKeys = FIELDS[tab].map(f => f.key)
    const payload = Object.fromEntries(Object.entries(form).filter(([k]) => allowedKeys.includes(k)))
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) { onSaved() } else {
      const d = await res.json()
      setError(d.error ?? 'Erreur')
    }
    setSaving(false)
  }

  return (
    <Modal title={titles[tab]} onClose={onClose} size="sm">
      <form onSubmit={submit} className="space-y-4">
        {FIELDS[tab].map(field => (
          <div key={field.key}>
            <label className="label">{field.label}{field.required && ' *'}</label>
            {field.type === 'select' ? (
              <select className="input" value={form[field.key] ?? ''} onChange={f(field.key)} required={field.required}>
                <option value="">Choisir...</option>
                {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input
                type={field.type ?? 'text'}
                className="input"
                value={form[field.key] ?? ''}
                onChange={f(field.key)}
                required={field.required}
              />
            )}
          </div>
        ))}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
