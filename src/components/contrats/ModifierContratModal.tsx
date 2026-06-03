'use client'
import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { Plus, Trash2 } from 'lucide-react'

interface Props {
  contrat: any
  onClose: () => void
  onSaved: () => void
}

export default function ModifierContratModal({ contrat, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    numero_contrat: contrat.numero_contrat ?? '',
    famille: contrat.famille ?? 'negoce',
    produit_id: contrat.produit_id ?? '',
    fournisseur_id: contrat.fournisseur_id ?? '',
    courtier_id: contrat.courtier_id ?? '',
    reference_fournisseur: contrat.reference_fournisseur ?? '',
    prix_achat: String(contrat.prix_achat ?? ''),
    quantite_totale: String(contrat.quantite_totale ?? ''),
    transporteur_id: contrat.transporteur_id ?? '',
    prix_transport_prevu: String(contrat.prix_transport_prevu ?? '0'),
    point_chargement: contrat.point_chargement ?? '',
    ville_chargement: contrat.ville_chargement ?? '',
    date_conclusion: contrat.date_conclusion ?? '',
    date_debut: contrat.date_debut ?? '',
    date_fin: contrat.date_fin ?? '',
    notes: contrat.notes ?? '',
    base_prix: contrat.base_prix ?? '',
    mbm_autorise: contrat.mbm_autorise ?? false,
  })

  // Adresses d'enlèvement multiples
  const adressesInitiales: string[] = Array.from(new Set(
    [contrat.ville_chargement, ...(contrat.livraisons ?? []).map((l: any) => l.ville_chargement)]
      .filter(Boolean)
  ))
  const [adressesSup, setAdressesSup] = useState<string[]>(
    adressesInitiales.filter((a: string) => a !== contrat.ville_chargement)
  )
  const [nouvelleAdresse, setNouvelleAdresse] = useState('')

  const [produits, setProduits] = useState<any[]>([])
  const [fournisseurs, setFournisseurs] = useState<any[]>([])
  const [courtiers, setCourtiers] = useState<any[]>([])
  const [transporteurs, setTransporteurs] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/referentiels/produits').then(r => r.json()),
      fetch('/api/referentiels/fournisseurs').then(r => r.json()),
      fetch('/api/referentiels/courtiers').then(r => r.json()),
      fetch('/api/referentiels/transporteurs').then(r => r.json()),
    ]).then(([p, f, c, t]) => { setProduits(p); setFournisseurs(f); setCourtiers(c); setTransporteurs(t) })
  }, [])

  const produitsFiltres = produits.filter(p => p.famille === form.famille)

  function f(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  function ajouterAdresse() {
    if (nouvelleAdresse.trim()) {
      setAdressesSup(prev => [...prev, nouvelleAdresse.trim()])
      setNouvelleAdresse('')
    }
  }

  function supprimerAdresse(i: number) {
    setAdressesSup(prev => prev.filter((_, idx) => idx !== i))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body = {
      ...form,
      courtier_id: form.courtier_id || null,
      date_conclusion: form.date_conclusion || null,
      prix_achat: parseFloat(form.prix_achat),
      quantite_totale: parseFloat(form.quantite_totale),
      prix_transport_prevu: parseFloat(form.prix_transport_prevu),
      date_debut: form.date_debut || null,
      date_fin: form.date_fin || null,
      adresses_chargement_sup: adressesSup,
      base_prix: form.famille === 'negoce' ? (form.base_prix || null) : null,
      mbm_autorise: form.famille === 'negoce' ? form.mbm_autorise : false,
    }
    const res = await fetch(`/api/contrats/${contrat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) { onSaved() } else {
      const d = await res.json()
      setError(d.error ?? 'Erreur lors de la sauvegarde')
    }
    setSaving(false)
  }

  // Toutes les adresses connues (principale + sup)
  const toutesAdresses = [form.ville_chargement, ...adressesSup].filter(Boolean)

  return (
    <Modal title="Modifier le contrat" onClose={onClose} size="xl">
      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">N° contrat *</label>
            <input className="input" value={form.numero_contrat} onChange={f('numero_contrat')} required />
          </div>
          <div>
            <label className="label">Famille</label>
            <select className="input" value={form.famille} onChange={f('famille')}>
              <option value="negoce">Négoce</option>
              <option value="appro">Appro</option>
            </select>
          </div>
          <div>
            <label className="label">Produit *</label>
            <select className="input" value={form.produit_id} onChange={f('produit_id')} required>
              <option value="">Choisir...</option>
              {produitsFiltres.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Fournisseur *</label>
            <select className="input" value={form.fournisseur_id} onChange={f('fournisseur_id')} required>
              <option value="">Choisir...</option>
              {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Référence fournisseur</label>
            <input className="input" value={form.reference_fournisseur} onChange={f('reference_fournisseur')} />
          </div>
          <div>
            <label className="label">Courtier</label>
            <select className="input" value={form.courtier_id} onChange={f('courtier_id')}>
              <option value="">Sans courtier</option>
              {courtiers.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Prix achat (€/t) *</label>
            <input type="number" step="0.01" className="input" value={form.prix_achat} onChange={f('prix_achat')} required />
          </div>
          <div>
            <label className="label">Quantité totale (t) *</label>
            <input type="number" step="0.001" className="input" value={form.quantite_totale} onChange={f('quantite_totale')} required />
          </div>
          <div>
            <label className="label">Transporteur *</label>
            <select className="input" value={form.transporteur_id} onChange={f('transporteur_id')} required>
              <option value="">Choisir...</option>
              {transporteurs.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Prix transport prévu (€/t)</label>
            <input type="number" step="0.01" className="input" value={form.prix_transport_prevu} onChange={f('prix_transport_prevu')} />
          </div>
          <div>
            <label className="label">Date conclusion</label>
            <input type="date" className="input" value={form.date_conclusion} onChange={f('date_conclusion')} />
          </div>
          <div />
          <div>
            <label className="label">Date début</label>
            <input type="date" className="input" value={form.date_debut} onChange={f('date_debut')} />
          </div>
          <div>
            <label className="label">Date fin</label>
            <input type="date" className="input" value={form.date_fin} onChange={f('date_fin')} />
          </div>
          {form.famille === 'negoce' && (
            <>
              <div>
                <label className="label">Base prix</label>
                <select className="input" value={form.base_prix} onChange={f('base_prix')}>
                  <option value="">— Non défini —</option>
                  <option value="juillet_2025">Base Juillet 2025</option>
                  <option value="juillet_2026">Base Juillet 2026</option>
                  <option value="juillet_2027">Base Juillet 2027</option>
                  <option value="juillet_2028">Base Juillet 2028</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-5">
                <input
                  type="checkbox"
                  id="mbm_autorise_modifier"
                  checked={form.mbm_autorise}
                  onChange={e => setForm(prev => ({ ...prev, mbm_autorise: e.target.checked }))}
                  className="w-4 h-4 rounded accent-green-600"
                />
                <label htmlFor="mbm_autorise_modifier" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  MBM autorisées <span className="text-xs text-gray-400 font-normal">(majorations applicables)</span>
                </label>
              </div>
            </>
          )}
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={f('notes')} />
          </div>
        </div>

        {/* Adresses d'enlèvement */}
        <div className="border-t border-gray-100 pt-4">
          <p className="font-semibold text-sm mb-1" style={{ color: '#7B2820' }}>Adresses d'enlèvement</p>
          <p className="text-xs text-gray-400 mb-3">Indiquez un ou plusieurs lieux de chargement — vous choisirez à chaque livraison</p>

          {/* Adresse principale */}
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <label className="label text-xs">Ville / lieu (adresse 1)</label>
              <input className="input" value={form.ville_chargement} onChange={f('ville_chargement')} placeholder="Ex : Villefranche-de-Rouergue" />
            </div>
            <div>
              <label className="label text-xs">Adresse complète (optionnel)</label>
              <input className="input" value={form.point_chargement} onChange={f('point_chargement')} placeholder="Lieu-dit, route..." />
            </div>
          </div>

          {/* Adresses supplémentaires */}
          {adressesSup.map((a, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input
                className="input flex-1"
                value={a}
                onChange={e => setAdressesSup(prev => prev.map((x, idx) => idx === i ? e.target.value : x))}
              />
              <button type="button" onClick={() => supprimerAdresse(i)} className="p-2 text-gray-400 hover:text-red-500">
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          {/* Ajouter une adresse */}
          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={nouvelleAdresse}
              onChange={e => setNouvelleAdresse(e.target.value)}
              placeholder="Ajouter une adresse d'enlèvement..."
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), ajouterAdresse())}
            />
            <button type="button" onClick={ajouterAdresse} className="btn-secondary text-xs py-2">
              <Plus size={14} /> Ajouter
            </button>
          </div>

          {toutesAdresses.length > 1 && (
            <p className="text-xs text-blue-600 mt-2">
              ✓ {toutesAdresses.length} adresses enregistrées — disponibles dans le menu déroulant à la création des livraisons
            </p>
          )}
        </div>

        {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
