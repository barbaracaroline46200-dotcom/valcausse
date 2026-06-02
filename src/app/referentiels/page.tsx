'use client'
import { useEffect, useState } from 'react'
import { BookOpen, Plus, Loader2, Users, Wheat, Truck, UserCheck, Package } from 'lucide-react'
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

export default function ReferentielsPage() {
  const { isAdmin } = useAdmin()
  const [tab, setTab] = useState<Tab>('fournisseurs')
  const [data, setData] = useState<Record<Tab, any[]>>({
    fournisseurs: [], agriculteurs: [], courtiers: [], transporteurs: [], produits: [],
  })
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

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
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Tabs */}
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

      {/* Contenu */}
      <div className="card-section overflow-hidden">
        <div className="overflow-x-auto">
          {tab === 'fournisseurs' && <FournisseursList data={data.fournisseurs} />}
          {tab === 'agriculteurs' && <AgriculteursList data={data.agriculteurs} />}
          {tab === 'courtiers' && <CortiersList data={data.courtiers} />}
          {tab === 'transporteurs' && <TransporteursList data={data.transporteurs} />}
          {tab === 'produits' && <ProduitsList data={data.produits} />}
        </div>
      </div>

      {showModal && (
        <AddModal tab={tab} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); loadAll() }} />
      )}
    </div>
  )
}

function FournisseursList({ data }: { data: any[] }) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50/50">
        <tr>{['Nom', 'Téléphone', 'Email', 'Points de chargement'].map(h => <th key={h} className="table-header">{h}</th>)}</tr>
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
          </tr>
        ))}
        {data.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Aucun fournisseur</td></tr>}
      </tbody>
    </table>
  )
}

function AgriculteursList({ data }: { data: any[] }) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50/50">
        <tr>{['Nom', 'Ville livraison', 'Téléphone', 'Email', 'N° client'].map(h => <th key={h} className="table-header">{h}</th>)}</tr>
      </thead>
      <tbody>
        {data.map(a => (
          <tr key={a.id} className="table-row">
            <td className="table-cell font-medium">{a.nom}</td>
            <td className="table-cell">{a.ville_livraison ?? '—'}</td>
            <td className="table-cell text-gray-500">{a.telephone ?? '—'}</td>
            <td className="table-cell text-gray-500">{a.email ?? '—'}</td>
            <td className="table-cell text-xs text-gray-400">{a.numero_client_logiciel ?? '—'}</td>
          </tr>
        ))}
        {data.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Aucun agriculteur</td></tr>}
      </tbody>
    </table>
  )
}

function CortiersList({ data }: { data: any[] }) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50/50">
        <tr>{['Nom', 'N° courtier', 'Téléphone', 'Email'].map(h => <th key={h} className="table-header">{h}</th>)}</tr>
      </thead>
      <tbody>
        {data.map(c => (
          <tr key={c.id} className="table-row">
            <td className="table-cell font-medium">{c.nom}</td>
            <td className="table-cell">{c.numero_courtier ?? '—'}</td>
            <td className="table-cell text-gray-500">{c.telephone ?? '—'}</td>
            <td className="table-cell text-gray-500">{c.email ?? '—'}</td>
          </tr>
        ))}
        {data.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Aucun courtier</td></tr>}
      </tbody>
    </table>
  )
}

function TransporteursList({ data }: { data: any[] }) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50/50">
        <tr>{['Nom', 'Téléphone', 'Email'].map(h => <th key={h} className="table-header">{h}</th>)}</tr>
      </thead>
      <tbody>
        {data.map(t => (
          <tr key={t.id} className="table-row">
            <td className="table-cell font-medium">{t.nom}</td>
            <td className="table-cell text-gray-500">{t.telephone ?? '—'}</td>
            <td className="table-cell text-gray-500">{t.email ?? '—'}</td>
          </tr>
        ))}
        {data.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">Aucun transporteur</td></tr>}
      </tbody>
    </table>
  )
}

function ProduitsList({ data }: { data: any[] }) {
  return (
    <table className="w-full">
      <thead className="bg-gray-50/50">
        <tr>{['Nom', 'Famille'].map(h => <th key={h} className="table-header">{h}</th>)}</tr>
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
          </tr>
        ))}
        {data.length === 0 && <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-400">Aucun produit</td></tr>}
      </tbody>
    </table>
  )
}

function AddModal({ tab, onClose, onSaved }: { tab: Tab; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const urls: Record<Tab, string> = {
    fournisseurs: '/api/referentiels/fournisseurs',
    agriculteurs: '/api/referentiels/agriculteurs',
    courtiers: '/api/referentiels/courtiers',
    transporteurs: '/api/referentiels/transporteurs',
    produits: '/api/referentiels/produits',
  }

  const titles: Record<Tab, string> = {
    fournisseurs: 'Ajouter un fournisseur',
    agriculteurs: 'Ajouter un agriculteur',
    courtiers: 'Ajouter un courtier',
    transporteurs: 'Ajouter un transporteur',
    produits: 'Ajouter un produit',
  }

  function f(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(urls[tab], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) { onSaved() } else {
      const d = await res.json()
      setError(d.error ?? 'Erreur')
    }
    setSaving(false)
  }

  const fields: Record<Tab, Array<{ key: string; label: string; required?: boolean; type?: string; options?: any[] }>> = {
    fournisseurs: [
      { key: 'nom', label: 'Nom', required: true },
      { key: 'telephone', label: 'Téléphone' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'adresse', label: 'Adresse' },
    ],
    agriculteurs: [
      { key: 'nom', label: 'Nom', required: true },
      { key: 'adresse_livraison', label: 'Adresse livraison' },
      { key: 'ville_livraison', label: 'Ville livraison' },
      { key: 'telephone', label: 'Téléphone' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'numero_client_logiciel', label: 'N° client logiciel' },
    ],
    courtiers: [
      { key: 'nom', label: 'Nom', required: true },
      { key: 'numero_courtier', label: 'N° courtier' },
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

  return (
    <Modal title={titles[tab]} onClose={onClose} size="sm">
      <form onSubmit={submit} className="space-y-4">
        {fields[tab].map(field => (
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
            {saving ? 'Enregistrement...' : 'Ajouter'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
