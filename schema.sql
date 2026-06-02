-- ============================================================
-- VALCAUSSE — Schéma SQL Supabase
-- À exécuter dans l'éditeur SQL de votre projet Supabase
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
create type famille_type as enum ('appro', 'negoce');
create type statut_contrat as enum ('en_cours', 'clos');
create type livraison_type as enum ('planifiee', 'realisee');

-- ============================================================
-- FAMILLES (référentiel statique)
-- ============================================================
create table familles (
  id uuid primary key default uuid_generate_v4(),
  code famille_type not null,
  libelle text not null
);

insert into familles (code, libelle) values
  ('appro', 'Betteraves'),
  ('appro', 'Tourteau de colza'),
  ('appro', 'Tourteau de soja'),
  ('appro', 'Tourteau de tournesol'),
  ('negoce', 'Avoine'),
  ('negoce', 'Blé'),
  ('negoce', 'Maïs'),
  ('negoce', 'Orge'),
  ('negoce', 'Tournesol'),
  ('negoce', 'Soja'),
  ('negoce', 'Triticale'),
  ('negoce', 'Sorgho');

-- ============================================================
-- PRODUITS
-- ============================================================
create table produits (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  famille famille_type not null,
  created_at timestamptz default now()
);

insert into produits (nom, famille) values
  ('Betteraves', 'appro'),
  ('Tourteau de colza', 'appro'),
  ('Tourteau de soja', 'appro'),
  ('Tourteau de tournesol', 'appro'),
  ('Avoine', 'negoce'),
  ('Blé', 'negoce'),
  ('Maïs', 'negoce'),
  ('Orge', 'negoce'),
  ('Tournesol', 'negoce'),
  ('Soja', 'negoce'),
  ('Triticale', 'negoce'),
  ('Sorgho', 'negoce');

-- ============================================================
-- FOURNISSEURS
-- ============================================================
create table fournisseurs (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  adresse text,
  telephone text,
  email text,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- POINTS DE CHARGEMENT
-- ============================================================
create table points_chargement (
  id uuid primary key default uuid_generate_v4(),
  fournisseur_id uuid not null references fournisseurs(id) on delete cascade,
  libelle text not null,
  adresse_complete text,
  ville text,
  created_at timestamptz default now()
);

-- ============================================================
-- AGRICULTEURS
-- ============================================================
create table agriculteurs (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  adresse_livraison text,
  ville_livraison text,
  telephone text,
  email text,
  numero_client_logiciel text,
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- COURTIERS
-- ============================================================
create table courtiers (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  numero_courtier text,
  telephone text,
  email text,
  created_at timestamptz default now()
);

-- ============================================================
-- TRANSPORTEURS
-- ============================================================
create table transporteurs (
  id uuid primary key default uuid_generate_v4(),
  nom text not null,
  telephone text,
  email text,
  created_at timestamptz default now()
);

-- ============================================================
-- CONTRATS D'ACHAT
-- ============================================================
create table contrats_achat (
  id uuid primary key default uuid_generate_v4(),
  numero_contrat text unique not null,
  famille famille_type not null,
  produit_id uuid not null references produits(id),
  fournisseur_id uuid not null references fournisseurs(id),
  courtier_id uuid references courtiers(id),
  reference_fournisseur text,
  numero_mise_a_disposition text,
  prix_achat numeric(10,2) not null,
  quantite_totale numeric(10,3) not null,
  transporteur_id uuid not null references transporteurs(id),
  prix_transport_prevu numeric(10,2) not null default 0,
  point_chargement text,
  ville_chargement text,
  date_debut date,
  date_fin date,
  statut statut_contrat not null default 'en_cours',
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- CONTRATS DE VENTE
-- ============================================================
create table contrats_vente (
  id uuid primary key default uuid_generate_v4(),
  numero_contrat text unique not null,
  contrat_achat_id uuid references contrats_achat(id),
  produit_id uuid not null references produits(id),
  agriculteur_id uuid not null references agriculteurs(id),
  prix_vente numeric(10,2) not null,
  quantite numeric(10,3) not null,
  statut statut_contrat not null default 'en_cours',
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- FACTURES FOURNISSEUR (déclarées avant livraisons pour la FK)
-- ============================================================
create table factures_fournisseur (
  id uuid primary key default uuid_generate_v4(),
  contrat_achat_id uuid not null references contrats_achat(id),
  numero_facture text not null,
  numero_piece_logiciel text,
  montant_ht numeric(12,2),
  montant_ttc numeric(12,2),
  mode_paiement text,
  date_paiement date,
  created_at timestamptz default now()
);

-- ============================================================
-- FACTURES TRANSPORTEUR
-- ============================================================
create table factures_transporteur (
  id uuid primary key default uuid_generate_v4(),
  transporteur_id uuid not null references transporteurs(id),
  mois_facture date not null,
  numero_facture text,
  montant_total_ttc numeric(12,2),
  created_at timestamptz default now()
);

-- ============================================================
-- FACTURES CLIENT
-- ============================================================
create table factures_client (
  id uuid primary key default uuid_generate_v4(),
  contrat_vente_id uuid not null references contrats_vente(id),
  numero_facture_logiciel text,
  montant_ht numeric(12,2),
  montant_ttc numeric(12,2),
  mode_paiement text,
  date_paiement date,
  created_at timestamptz default now()
);

-- ============================================================
-- LIVRAISONS
-- ============================================================
create table livraisons (
  id uuid primary key default uuid_generate_v4(),
  contrat_achat_id uuid not null references contrats_achat(id),
  type livraison_type not null default 'planifiee',
  mois_prevu date not null,
  quantite_prevue numeric(10,3) not null,
  quantite_reelle numeric(10,3),
  date_reelle date,
  ville_chargement text,
  ville_destination text,
  numero_lettre_voiture text,
  piece_fournisseur_prefixe text,
  piece_fournisseur_numero text,
  piece_client_prefixe text,
  piece_client_numero text,
  facture_fournisseur_id uuid references factures_fournisseur(id),
  facture_transporteur_id uuid references factures_transporteur(id),
  montant_transport_reel numeric(10,2),
  transport_facture boolean default false,
  transporteur_contacte boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- FONCTION : mise à jour statut contrat d'achat automatique
-- ============================================================
create or replace function update_statut_contrat_achat()
returns trigger language plpgsql as $$
declare
  v_quantite_totale numeric;
  v_quantite_livree numeric;
begin
  select quantite_totale into v_quantite_totale
  from contrats_achat
  where id = new.contrat_achat_id;

  select coalesce(sum(quantite_reelle), 0) into v_quantite_livree
  from livraisons
  where contrat_achat_id = new.contrat_achat_id
    and type = 'realisee'
    and quantite_reelle is not null;

  if v_quantite_livree >= v_quantite_totale then
    update contrats_achat set statut = 'clos'
    where id = new.contrat_achat_id and statut = 'en_cours';
  end if;

  return new;
end;
$$;

create trigger trg_update_statut_contrat_achat
after insert or update on livraisons
for each row execute function update_statut_contrat_achat();

-- ============================================================
-- ROW LEVEL SECURITY — Lecture publique, écriture via API sécurisée
-- ============================================================
alter table produits enable row level security;
alter table fournisseurs enable row level security;
alter table points_chargement enable row level security;
alter table agriculteurs enable row level security;
alter table courtiers enable row level security;
alter table transporteurs enable row level security;
alter table contrats_achat enable row level security;
alter table contrats_vente enable row level security;
alter table livraisons enable row level security;
alter table factures_fournisseur enable row level security;
alter table factures_transporteur enable row level security;
alter table factures_client enable row level security;

-- Politiques lecture publique (anon + authenticated)
do $$
declare
  t text;
begin
  foreach t in array array[
    'produits','fournisseurs','points_chargement','agriculteurs',
    'courtiers','transporteurs','contrats_achat','contrats_vente',
    'livraisons','factures_fournisseur','factures_transporteur','factures_client'
  ] loop
    execute format(
      'create policy "Lecture publique %1$s" on %1$s for select using (true)', t
    );
    execute format(
      'create policy "Ecriture service_role %1$s" on %1$s for all using (auth.role() = ''service_role'')', t
    );
  end loop;
end $$;

-- ============================================================
-- INDEX pour performances
-- ============================================================
create index idx_livraisons_contrat on livraisons(contrat_achat_id);
create index idx_livraisons_type on livraisons(type);
create index idx_livraisons_mois on livraisons(mois_prevu);
create index idx_contrats_achat_statut on contrats_achat(statut);
create index idx_contrats_achat_fournisseur on contrats_achat(fournisseur_id);
create index idx_contrats_vente_contrat_achat on contrats_vente(contrat_achat_id);
create index idx_contrats_vente_agriculteur on contrats_vente(agriculteur_id);
