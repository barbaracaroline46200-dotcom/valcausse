export type FamilleType = 'appro' | 'negoce'
export type StatutContrat = 'en_cours' | 'clos'
export type LivraisonType = 'planifiee' | 'realisee'

export interface Produit {
  id: string
  nom: string
  famille: FamilleType
  created_at: string
}

export interface Fournisseur {
  id: string
  nom: string
  adresse?: string
  telephone?: string
  email?: string
  notes?: string
  created_at: string
  points_chargement?: PointChargement[]
}

export interface PointChargement {
  id: string
  fournisseur_id: string
  libelle: string
  adresse_complete?: string
  ville?: string
  created_at: string
}

export interface Agriculteur {
  id: string
  nom: string
  adresse_livraison?: string
  ville_livraison?: string
  telephone?: string
  email?: string
  numero_client_logiciel?: string
  notes?: string
  created_at: string
}

export interface Courtier {
  id: string
  nom: string
  numero_courtier?: string
  telephone?: string
  email?: string
  created_at: string
}

export interface Transporteur {
  id: string
  nom: string
  telephone?: string
  email?: string
  created_at: string
}

export interface ContratAchat {
  id: string
  numero_contrat: string
  famille: FamilleType
  produit_id: string
  fournisseur_id: string
  courtier_id?: string
  reference_fournisseur?: string
  numero_mise_a_disposition?: string
  prix_achat: number
  quantite_totale: number
  transporteur_id: string
  prix_transport_prevu: number
  point_chargement?: string
  ville_chargement?: string
  date_debut?: string
  date_fin?: string
  statut: StatutContrat
  notes?: string
  created_at: string
  // Joins
  produit?: Produit
  fournisseur?: Fournisseur
  courtier?: Courtier
  transporteur?: Transporteur
  livraisons?: Livraison[]
  contrats_vente?: ContratVente[]
}

export interface ContratVente {
  id: string
  numero_contrat: string
  contrat_achat_id?: string
  produit_id: string
  agriculteur_id: string
  prix_vente: number
  quantite: number
  statut: StatutContrat
  notes?: string
  created_at: string
  // Joins
  produit?: Produit
  agriculteur?: Agriculteur
  contrat_achat?: ContratAchat
  factures_client?: FactureClient[]
}

export interface Livraison {
  id: string
  contrat_achat_id: string
  type: LivraisonType
  mois_prevu: string
  quantite_prevue: number
  quantite_reelle?: number
  date_reelle?: string
  ville_chargement?: string
  ville_destination?: string
  numero_lettre_voiture?: string
  piece_fournisseur_prefixe?: string
  piece_fournisseur_numero?: string
  piece_client_prefixe?: string
  piece_client_numero?: string
  facture_fournisseur_id?: string
  facture_transporteur_id?: string
  montant_transport_reel?: number
  transport_facture: boolean
  transporteur_contacte: boolean
  created_at: string
  // Joins
  contrat_achat?: ContratAchat
}

export interface FactureFournisseur {
  id: string
  contrat_achat_id: string
  numero_facture: string
  numero_piece_logiciel?: string
  montant_ht?: number
  montant_ttc?: number
  mode_paiement?: string
  date_paiement?: string
  created_at: string
}

export interface FactureTransporteur {
  id: string
  transporteur_id: string
  mois_facture: string
  numero_facture?: string
  montant_total_ttc?: number
  created_at: string
  transporteur?: Transporteur
}

export interface FactureClient {
  id: string
  contrat_vente_id: string
  numero_facture_logiciel?: string
  montant_ht?: number
  montant_ttc?: number
  mode_paiement?: string
  date_paiement?: string
  created_at: string
}
