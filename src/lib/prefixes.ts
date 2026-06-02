import type { FamilleType } from '@/types'

export function getPrefixes(famille: FamilleType) {
  if (famille === 'negoce') {
    return {
      fournisseur: 'BA',
      client: 'LVC',
      factureAchat: 'FAN',
      contratAchat: 'CA',
      contratVente: 'CV',
    }
  }
  return {
    fournisseur: 'EA',
    client: 'LA',
    factureAchat: 'FAF',
    contratAchat: 'CF',
    contratVente: 'CC',
  }
}

export function getLibelleFamille(famille: FamilleType): string {
  return famille === 'negoce' ? 'Négoce' : 'Appro'
}
