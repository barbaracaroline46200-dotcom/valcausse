'use client'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { FileWarning, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/annee-agricole'

export default function RfPage() {
  const pathname = usePathname()
  const [rfManquants, setRfManquants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const res = await fetch('/api/dashboard')
    const d = await res.json()
    setRfManquants(d.rfManquants ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [])
  useEffect(() => { if (!loading) reload() }, [pathname])
  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-green-600" size={32} />
    </div>
  )

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#dc2626' }}>
          <FileWarning size={22} />
          RF à récupérer
          {rfManquants.length > 0 && (
            <span className="ml-2 min-w-[24px] h-6 px-2 rounded-full text-white text-sm font-bold flex items-center justify-center bg-red-600">
              {rfManquants.length}
            </span>
          )}
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Factures fournisseur sans numéro RF — à recevoir de la comptable</p>
      </div>

      <div className="card-section overflow-hidden">
        {rfManquants.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-500 text-sm">Aucun RF en attente 🎉</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Fournisseur', 'Produit', 'Contrat', 'N° Facture', 'Date', 'Montant HT', 'Saisir RF'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rfManquants.map((f: any) => (
                <tr key={f.id} className="table-row">
                  <td className="table-cell font-medium">{f.contrat_achat?.fournisseur?.nom ?? '—'}</td>
                  <td className="table-cell">{f.contrat_achat?.produit?.nom ?? '—'}</td>
                  <td className="table-cell">
                    <a href={`/contrats/${f.contrat_achat?.id}`} className="text-green-700 hover:underline text-sm">{f.contrat_achat?.numero_contrat}</a>
                  </td>
                  <td className="table-cell">{f.numero_facture ?? '—'}</td>
                  <td className="table-cell">{formatDate(f.date_facture)}</td>
                  <td className="table-cell">{f.montant_ht ? `${f.montant_ht} €` : '—'}</td>
                  <td className="table-cell">
                    <SaisirRFInline factureId={f.id} onSaved={reload} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function SaisirRFInline({ factureId, onSaved }: { factureId: string; onSaved: () => void }) {
  const [rf, setRf] = useState('')
  const [datePaiement, setDatePaiement] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!rf) return
    setSaving(true)
    await fetch(`/api/factures/fournisseur/${factureId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero_piece_logiciel: rf, date_paiement: datePaiement || null }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="flex items-center gap-1">
      <input type="text" value={rf} onChange={e => setRf(e.target.value)}
        placeholder="N° RF"
        className="text-xs border border-gray-200 rounded px-1.5 py-0.5 w-20 focus:outline-none focus:border-red-400"
      />
      <input type="date" value={datePaiement} onChange={e => setDatePaiement(e.target.value)}
        title="Date de paiement"
        className="text-xs border border-gray-200 rounded px-1.5 py-0.5 w-28 focus:outline-none focus:border-red-400"
      />
      <button onClick={save} disabled={!rf || saving}
        className="text-xs px-2 py-0.5 rounded bg-red-600 text-white disabled:opacity-40 hover:bg-red-700">
        {saving ? '...' : '✓'}
      </button>
    </div>
  )
}
