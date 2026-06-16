'use client'
import { useState, useCallback } from 'react'
import { Search, Loader2, FileText, ShoppingCart, Truck, Package, Users, Wheat, Scale } from 'lucide-react'
import { formatTonnes, formatDate } from '@/lib/annee-agricole'
import { BadgeFamille } from '@/components/ui/Badge'
import Link from 'next/link'

export default function RecherchePage() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (query: string) => {
    if (query.length < 2) { setResults(null); return }
    setLoading(true)
    const data = await fetch(`/api/recherche?q=${encodeURIComponent(query)}`).then(r => r.json())
    setResults(data)
    setLoading(false)
  }, [])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQ(v)
    const t = setTimeout(() => search(v), 300)
    return () => clearTimeout(t)
  }

  const total = results
    ? (results.contrats?.length ?? 0) + (results.ventes?.length ?? 0) + (results.livraisons?.length ?? 0) +
      (results.fournisseurs?.length ?? 0) + (results.agriculteurs?.length ?? 0) + (results.transporteurs?.length ?? 0) +
      (results.livraisonsParPoids?.length ?? 0)
    : 0

  return (
    <div className="space-y-6 pb-10 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#7B2820' }}>
          <Search size={24} style={{ color: '#C8941A' }} />
          Recherche globale
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Contrats, pièces, noms, villes… ou un poids en tonnes (ex&nbsp;: 27.92)</p>
      </div>

      <div className="relative">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={q}
          onChange={handleInput}
          placeholder="Rechercher un numéro, un nom, une ville…"
          className="input pl-12 py-3 text-base shadow-sm"
          autoFocus
        />
        {loading && <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
      </div>

      {q.length >= 2 && !loading && results && total === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Search size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucun résultat pour « {q} »</p>
        </div>
      )}

      {results && total > 0 && (
        <div className="space-y-5">
          {results.livraisonsParPoids?.length > 0 && (
            <ResultGroup title="Livraisons par poids réalisé" icon={<Scale size={16} />} count={results.livraisonsParPoids.length}>
              {(results.livraisonsParPoids ?? []).map((l: any) => {
                const ca = l.contrat_achat ?? null
                const cv = l.contrat_vente ?? null
                return (
                  <ResultItem key={l.id} href={ca ? `/contrats/${ca.id}` : `/contrats/${l.contrat_achat_id}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-blue-700">{formatTonnes(l.quantite_reelle)}</span>
                      {ca?.numero_contrat && <span className="font-semibold text-green-700">{ca.numero_contrat}</span>}
                      {ca?.famille && <BadgeFamille famille={ca.famille} />}
                      {l.piece_fournisseur_numero && (
                        <span className="badge-appro text-xs">{l.piece_fournisseur_prefixe} {l.piece_fournisseur_numero}</span>
                      )}
                      {l.piece_client_numero && (
                        <span className="badge-negoce text-xs">{l.piece_client_prefixe} {l.piece_client_numero}</span>
                      )}
                      {l.numero_lettre_voiture && (
                        <span className="badge-clos text-xs">CMR {l.numero_lettre_voiture}</span>
                      )}
                    </div>
                    <span className="text-gray-500 text-sm">
                      {[
                        ca?.produit?.nom,
                        ca?.fournisseur?.nom,
                        cv?.agriculteur?.nom ? `🌾 ${cv.agriculteur.nom}${cv.numero_contrat ? ` (${cv.numero_contrat})` : ''}` : null,
                        l.date_reelle ? formatDate(l.date_reelle) : null,
                        l.ville_chargement && l.ville_destination ? `${l.ville_chargement} → ${l.ville_destination}` : (l.ville_destination ?? l.ville_chargement ?? null),
                      ].filter(Boolean).join(' · ')}
                    </span>
                  </ResultItem>
                )
              })}
            </ResultGroup>
          )}

          {results.contrats?.length > 0 && (
            <ResultGroup title="Contrats d'achat" icon={<FileText size={16} />} count={results.contrats.length}>
              {results.contrats.map((c: any) => (
                <ResultItem key={c.id} href={`/contrats/${c.id}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-green-700">{c.numero_contrat}</span>
                    <BadgeFamille famille={c.famille} />
                  </div>
                  <span className="text-gray-500 text-sm">
                    {[c.produit?.nom, c.fournisseur?.nom].filter(Boolean).join(' · ')}
                  </span>
                  {c.reference_fournisseur && (
                    <span className="text-xs text-gray-400 italic">Réf. fournisseur : {c.reference_fournisseur}</span>
                  )}
                </ResultItem>
              ))}
            </ResultGroup>
          )}

          {results.ventes?.length > 0 && (
            <ResultGroup title="Contrats de vente" icon={<ShoppingCart size={16} />} count={results.ventes.length}>
              {results.ventes.map((v: any) => (
                <ResultItem key={v.id} href={v.contrat_achat?.id ? `/contrats/${v.contrat_achat.id}` : `/ventes`}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-green-700">{v.numero_contrat}</span>
                    {v.contrat_achat && <BadgeFamille famille={v.contrat_achat.famille} />}
                  </div>
                  <span className="text-gray-500 text-sm">
                    {[v.produit?.nom, v.agriculteur?.nom, v.contrat_achat?.numero_contrat].filter(Boolean).join(' · ')}
                  </span>
                </ResultItem>
              ))}
            </ResultGroup>
          )}

          {results.livraisons?.length > 0 && (
            <ResultGroup title="Livraisons / Pièces" icon={<Truck size={16} />} count={results.livraisons.length}>
              {results.livraisons.map((l: any) => {
                const ca = l.contrat_achat ?? null
                const cv = l.contrat_vente ?? null
                const details = [
                  ca?.numero_contrat,
                  ca?.produit?.nom,
                  ca?.fournisseur?.nom,
                  cv?.agriculteur?.nom,
                  l.ville_chargement && l.ville_destination ? `${l.ville_chargement} → ${l.ville_destination}` : (l.ville_chargement || l.ville_destination),
                  l.date_reelle ? formatDate(l.date_reelle) : null,
                ].filter(Boolean).join(' · ')
                return (
                  <ResultItem key={l.id} href={`/contrats/${l.contrat_achat_id}`}>
                    <div className="flex flex-wrap gap-2 items-center">
                      {l.piece_fournisseur_numero && (
                        <span className="badge-appro">{l.piece_fournisseur_prefixe} {l.piece_fournisseur_numero}</span>
                      )}
                      {l.piece_client_numero && (
                        <span className="badge-negoce">{l.piece_client_prefixe} {l.piece_client_numero}</span>
                      )}
                      {l.numero_lettre_voiture && (
                        <span className="badge-clos">CMR {l.numero_lettre_voiture}</span>
                      )}
                      {l.numero_mise_a_disposition && (
                        <span className="badge-en_cours">{l.numero_mise_a_disposition}</span>
                      )}
                    </div>
                    {details && <span className="text-gray-500 text-sm">{details}</span>}
                  </ResultItem>
                )
              })}
            </ResultGroup>
          )}

          {results.fournisseurs?.length > 0 && (
            <ResultGroup title="Fournisseurs" icon={<Wheat size={16} />} count={results.fournisseurs.length}>
              {results.fournisseurs.map((f: any) => (
                <ResultItem key={f.id} href="/contrats">
                  <span className="font-medium">{f.nom}</span>
                </ResultItem>
              ))}
            </ResultGroup>
          )}

          {results.agriculteurs?.length > 0 && (
            <ResultGroup title="Agriculteurs" icon={<Users size={16} />} count={results.agriculteurs.length}>
              {results.agriculteurs.map((a: any) => (
                <ResultItem key={a.id} href="/ventes">
                  <span className="font-medium">{a.nom}</span>
                  {a.ville_livraison && <span className="text-gray-500 text-sm">{a.ville_livraison}</span>}
                </ResultItem>
              ))}
            </ResultGroup>
          )}

          {results.transporteurs?.length > 0 && (
            <ResultGroup title="Transporteurs" icon={<Truck size={16} />} count={results.transporteurs.length}>
              {results.transporteurs.map((t: any) => (
                <ResultItem key={t.id} href="/transporteurs/factures">
                  <span className="font-medium">{t.nom}</span>
                </ResultItem>
              ))}
            </ResultGroup>
          )}
        </div>
      )}
    </div>
  )
}

function ResultGroup({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <div className="card-section overflow-hidden">
      <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100 flex items-center gap-2">
        <span className="text-gray-500">{icon}</span>
        <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
        <span className="ml-auto text-xs text-gray-400">{count} résultat{count > 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  )
}

function ResultItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center justify-between px-4 py-3 hover:bg-green-50 transition-colors gap-4">
      <div className="flex flex-col gap-0.5 min-w-0">{children}</div>
      <span className="text-green-600 text-sm flex-shrink-0">→</span>
    </Link>
  )
}
