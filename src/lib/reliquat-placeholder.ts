// Si un contrat de vente garde un reliquat (>= 10t, cf. seuil de clôture automatique
// des contrats) mais n'a plus aucune livraison planifiée pour le couvrir — typiquement
// parce que la dernière planifiée vient d'être réalisée ou supprimée, ou que son contrat
// d'achat source a été clos avant d'avoir tout fourni — le reste à livrer disparaît
// silencieusement de "Livraisons à organiser" / "Planning". On recrée systématiquement
// une livraison "planifiee" placeholder pour que ce reliquat reste visible et ne soit
// jamais oublié (cf. CC.0704660 : contrat d'achat source clos à 85/150t livrées).
export async function creerPlaceholderReliquatSiNecessaire(
  supabase: any,
  cv: { id: string; quantite: number; livraisons: Array<{ type: string; quantite_reelle?: number | null }> }
) {
  const livs = cv.livraisons ?? []
  if (livs.some(l => l.type === 'planifiee')) return // déjà une livraison à venir programmée
  const livree = livs.filter(l => l.type === 'realisee').reduce((s, l) => s + (l.quantite_reelle ?? 0), 0)
  const reliquat = (cv.quantite ?? 0) - livree
  if (reliquat <= 0.01) return

  const { data: liens } = await supabase
    .from('contrats_vente_liens')
    .select('contrat_achat:contrats_achat(id,statut)')
    .eq('contrat_vente_id', cv.id)
  const achatId = (liens ?? []).find((l: any) => l.contrat_achat?.statut === 'en_cours')?.contrat_achat?.id
    ?? liens?.[0]?.contrat_achat?.id
    ?? null

  await supabase.from('livraisons').insert({
    type: 'planifiee',
    contrat_vente_id: cv.id,
    contrat_achat_id: achatId,
    quantite_prevue: reliquat,
    mois_prevu: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  })
}
