-- =====================================================================
-- Carnet auto famille — schéma V1
-- Principe de sécurité :
--   * "famille" = profils marqués est_membre (le 1er inscrit, puis les
--     emails invités). Un inconnu qui s'inscrit ne voit rien.
--   * Les données d'une voiture ne sont visibles que par ses membres
--     (table vehicle_members).
-- =====================================================================

-- ---------- Profils ---------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  prenom text,
  est_admin boolean not null default false,
  est_membre boolean not null default false,
  created_at timestamptz not null default now()
);

-- Invitations dans la famille (par email)
create table public.invitations (
  email text primary key,
  invite_par uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invitations_email_minuscule check (email = lower(email))
);

-- ---------- Garages ---------------------------------------------------
create table public.garages (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text,
  adresse text,
  source text not null default 'manuel' check (source in ('manuel', 'facture')),
  cree_par uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- Voitures --------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plaque text not null,
  marque text,
  modele text,
  date_1re_immat date,
  vin text,
  type_mine text,                       -- case D.2.1 de la carte grise
  km_actuel integer check (km_actuel >= 0),
  dimension_pneus text,                 -- ex. 205/55 R16 91V
  alterne_saisons boolean not null default false,
  intervalle_revision_mois integer not null default 12 check (intervalle_revision_mois > 0),
  intervalle_revision_km integer not null default 15000 check (intervalle_revision_km > 0),
  prochain_ct date,                     -- si renseigné, remplace le calcul automatique
  assureur text,
  numero_contrat text,
  tel_assistance text,
  echeance_assurance date,
  garage_habituel_id uuid references public.garages (id) on delete set null,
  photo_path text,
  archivee boolean not null default false,
  cree_par uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.vehicle_members (
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  notifications boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (vehicle_id, user_id)
);
create index vehicle_members_user_idx on public.vehicle_members (user_id);

-- ---------- Interventions (= fil d'activité) ---------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  type text not null check (type in (
    'revision', 'vidange', 'plaquettes_av', 'plaquettes_ar', 'disques_av', 'disques_ar',
    'essuie_glaces', 'batterie', 'pneus', 'courroie', 'filtres', 'controle_technique',
    'changement_saison', 'autre'
  )),
  libelle text,                          -- précision pour "autre" ou détail libre
  date date not null default current_date,
  km integer check (km >= 0),
  cout numeric(10, 2) check (cout >= 0),
  garage_id uuid references public.garages (id) on delete set null,
  note text,
  auteur_id uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index events_vehicle_date_idx on public.events (vehicle_id, date desc);
create index events_garage_idx on public.events (garage_id);

-- ---------- Pneus -----------------------------------------------------
create table public.tyre_sets (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  saison text not null check (saison in ('ete', 'hiver', '4saisons')),
  marque text,
  etat text not null default 'neuf' check (etat in ('neuf', 'mi_use', 'a_changer')),
  statut text not null default 'monte' check (statut in ('monte', 'box')),
  emplacement_box text,
  date_depot date,
  created_at timestamptz not null default now()
);
create index tyre_sets_vehicle_idx on public.tyre_sets (vehicle_id);

-- ---------- Kilométrage -----------------------------------------------
create table public.mileage_readings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  km integer not null check (km >= 0),
  date date not null default current_date,
  auteur_id uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index mileage_vehicle_date_idx on public.mileage_readings (vehicle_id, date desc);

-- ---------- Documents -------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  type text not null check (type in ('carte_grise', 'assurance', 'controle_technique', 'facture', 'autre')),
  fichier_path text not null,            -- chemin dans le bucket "documents" : <vehicle_id>/<fichier>
  nom text,
  auteur_id uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index documents_vehicle_idx on public.documents (vehicle_id);
create index documents_event_idx on public.documents (event_id);

-- ---------- Fiche pièces ----------------------------------------------
create table public.parts (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  categorie text not null,               -- plaquettes, disques, filtre_huile, ...
  position text check (position in ('av', 'ar')),
  reference text,
  marque text,
  source text not null default 'manuel' check (source in ('manuel', 'facture', 'catalogue')),
  event_id uuid references public.events (id) on delete set null,
  date_maj timestamptz not null default now()
);
create index parts_vehicle_idx on public.parts (vehicle_id);
create index parts_event_idx on public.parts (event_id);

-- ---------- Vérification mensuelle (V2, table prête) -------------------
create table public.monthly_checks (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  date date not null default current_date,
  auteur_id uuid references public.profiles (id) on delete set null default auth.uid(),
  pression_ok boolean,
  huile_ok boolean,
  lave_glace_ok boolean,
  eclairage_ok boolean,
  km integer check (km >= 0),
  note text,
  created_at timestamptz not null default now()
);
create index monthly_checks_vehicle_idx on public.monthly_checks (vehicle_id);

-- ---------- Notifications push (V2, table prête) -----------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Index sur les clés étrangères "auteur / créateur"
create index garages_cree_par_idx on public.garages (cree_par);
create index vehicles_cree_par_idx on public.vehicles (cree_par);
create index vehicles_garage_idx on public.vehicles (garage_habituel_id);
create index events_auteur_idx on public.events (auteur_id);
create index mileage_auteur_idx on public.mileage_readings (auteur_id);
create index documents_auteur_idx on public.documents (auteur_id);
create index monthly_checks_auteur_idx on public.monthly_checks (auteur_id);
create index invitations_invite_par_idx on public.invitations (invite_par);

-- =====================================================================
-- Fonctions d'aide pour la sécurité (security definer, search_path vide)
-- =====================================================================
create or replace function public.est_famille()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.est_membre
  );
$$;

create or replace function public.est_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.est_admin
  );
$$;

create or replace function public.est_membre_voiture(v uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.vehicle_members vm
    join public.profiles p on p.id = vm.user_id
    where vm.vehicle_id = v and vm.user_id = (select auth.uid()) and p.est_membre
  );
$$;

-- Création automatique du profil à l'inscription
create or replace function public.creer_profil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  premier boolean;
  invite boolean;
begin
  select not exists (select 1 from public.profiles) into premier;
  select exists (select 1 from public.invitations i where i.email = lower(new.email)) into invite;
  insert into public.profiles (id, email, est_admin, est_membre)
  values (new.id, lower(new.email), premier, premier or invite);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.creer_profil();

-- Invitation d'un email déjà inscrit : il devient membre tout de suite
create or replace function public.activer_invite()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set est_membre = true where email = new.email;
  return new;
end;
$$;

create trigger on_invitation_created
  after insert on public.invitations
  for each row execute function public.activer_invite();

-- Empêche un non-admin de modifier les drapeaux admin / membre
create or replace function public.proteger_profil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (new.est_admin is distinct from old.est_admin or new.est_membre is distinct from old.est_membre
      or new.email is distinct from old.email)
     and not public.est_admin()
     and (select auth.uid()) is not null then
    raise exception 'Seul un admin peut modifier ces informations';
  end if;
  return new;
end;
$$;

create trigger profiles_proteger
  before update on public.profiles
  for each row execute function public.proteger_profil();

-- Le créateur d'une voiture en devient automatiquement membre
create or replace function public.ajouter_createur_voiture()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    insert into public.vehicle_members (vehicle_id, user_id)
    values (new.id, (select auth.uid()))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger vehicles_ajouter_createur
  after insert on public.vehicles
  for each row execute function public.ajouter_createur_voiture();

-- Les fonctions de trigger ne doivent pas être appelables via l'API
revoke execute on function public.creer_profil() from public, anon, authenticated;
revoke execute on function public.activer_invite() from public, anon, authenticated;
revoke execute on function public.proteger_profil() from public, anon, authenticated;
revoke execute on function public.ajouter_createur_voiture() from public, anon, authenticated;
revoke execute on function public.est_famille() from public, anon;
revoke execute on function public.est_admin() from public, anon;
revoke execute on function public.est_membre_voiture(uuid) from public, anon;
grant execute on function public.est_famille() to authenticated;
grant execute on function public.est_admin() to authenticated;
grant execute on function public.est_membre_voiture(uuid) to authenticated;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.garages enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_members enable row level security;
alter table public.events enable row level security;
alter table public.tyre_sets enable row level security;
alter table public.mileage_readings enable row level security;
alter table public.documents enable row level security;
alter table public.parts enable row level security;
alter table public.monthly_checks enable row level security;
alter table public.push_subscriptions enable row level security;

-- Profils : chacun voit le sien ; la famille voit la famille
create policy profils_lecture on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.est_famille()));
create policy profils_maj on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.est_admin()))
  with check (id = (select auth.uid()) or (select public.est_admin()));

-- Invitations
create policy invitations_lecture on public.invitations for select to authenticated
  using ((select public.est_famille()));
create policy invitations_ajout on public.invitations for insert to authenticated
  with check ((select public.est_famille()));
create policy invitations_suppr on public.invitations for delete to authenticated
  using ((select public.est_admin()));

-- Garages : partagés dans la famille
create policy garages_lecture on public.garages for select to authenticated
  using ((select public.est_famille()));
create policy garages_ajout on public.garages for insert to authenticated
  with check ((select public.est_famille()));
create policy garages_maj on public.garages for update to authenticated
  using ((select public.est_famille())) with check ((select public.est_famille()));
create policy garages_suppr on public.garages for delete to authenticated
  using ((select public.est_admin()) or (cree_par = (select auth.uid()) and (select public.est_famille())));

-- Voitures
create policy voitures_lecture on public.vehicles for select to authenticated
  using ((select public.est_membre_voiture(id)));
create policy voitures_ajout on public.vehicles for insert to authenticated
  with check ((select public.est_famille()));
create policy voitures_maj on public.vehicles for update to authenticated
  using ((select public.est_membre_voiture(id))) with check ((select public.est_membre_voiture(id)));
create policy voitures_suppr on public.vehicles for delete to authenticated
  using ((select public.est_admin()));

-- Membres d'une voiture : visibles par la famille, gérés par les membres de la voiture
create policy membres_lecture on public.vehicle_members for select to authenticated
  using ((select public.est_famille()));
create policy membres_ajout on public.vehicle_members for insert to authenticated
  with check ((select public.est_membre_voiture(vehicle_id)));
create policy membres_maj on public.vehicle_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy membres_suppr on public.vehicle_members for delete to authenticated
  using ((select public.est_membre_voiture(vehicle_id)));

-- Interventions : membres de la voiture ; suppression par l'auteur ou un admin
create policy events_lecture on public.events for select to authenticated
  using ((select public.est_membre_voiture(vehicle_id)));
create policy events_ajout on public.events for insert to authenticated
  with check ((select public.est_membre_voiture(vehicle_id)));
create policy events_maj on public.events for update to authenticated
  using ((select public.est_membre_voiture(vehicle_id))) with check ((select public.est_membre_voiture(vehicle_id)));
create policy events_suppr on public.events for delete to authenticated
  using ((select public.est_membre_voiture(vehicle_id))
         and (auteur_id = (select auth.uid()) or (select public.est_admin())));

-- Tables rattachées à une voiture : tout membre de la voiture
create policy pneus_lecture on public.tyre_sets for select to authenticated using ((select public.est_membre_voiture(vehicle_id)));
create policy pneus_ajout on public.tyre_sets for insert to authenticated with check ((select public.est_membre_voiture(vehicle_id)));
create policy pneus_maj on public.tyre_sets for update to authenticated using ((select public.est_membre_voiture(vehicle_id))) with check ((select public.est_membre_voiture(vehicle_id)));
create policy pneus_suppr on public.tyre_sets for delete to authenticated using ((select public.est_membre_voiture(vehicle_id)));

create policy km_lecture on public.mileage_readings for select to authenticated using ((select public.est_membre_voiture(vehicle_id)));
create policy km_ajout on public.mileage_readings for insert to authenticated with check ((select public.est_membre_voiture(vehicle_id)));
create policy km_suppr on public.mileage_readings for delete to authenticated
  using ((select public.est_membre_voiture(vehicle_id)) and (auteur_id = (select auth.uid()) or (select public.est_admin())));

create policy docs_lecture on public.documents for select to authenticated using ((select public.est_membre_voiture(vehicle_id)));
create policy docs_ajout on public.documents for insert to authenticated with check ((select public.est_membre_voiture(vehicle_id)));
create policy docs_maj on public.documents for update to authenticated using ((select public.est_membre_voiture(vehicle_id))) with check ((select public.est_membre_voiture(vehicle_id)));
create policy docs_suppr on public.documents for delete to authenticated
  using ((select public.est_membre_voiture(vehicle_id)) and (auteur_id = (select auth.uid()) or (select public.est_admin())));

create policy pieces_lecture on public.parts for select to authenticated using ((select public.est_membre_voiture(vehicle_id)));
create policy pieces_ajout on public.parts for insert to authenticated with check ((select public.est_membre_voiture(vehicle_id)));
create policy pieces_maj on public.parts for update to authenticated using ((select public.est_membre_voiture(vehicle_id))) with check ((select public.est_membre_voiture(vehicle_id)));
create policy pieces_suppr on public.parts for delete to authenticated using ((select public.est_membre_voiture(vehicle_id)));

create policy checks_lecture on public.monthly_checks for select to authenticated using ((select public.est_membre_voiture(vehicle_id)));
create policy checks_ajout on public.monthly_checks for insert to authenticated with check ((select public.est_membre_voiture(vehicle_id)));
create policy checks_suppr on public.monthly_checks for delete to authenticated
  using ((select public.est_membre_voiture(vehicle_id)) and (auteur_id = (select auth.uid()) or (select public.est_admin())));

-- Abonnements push : chacun les siens
create policy push_lecture on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_ajout on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_suppr on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- =====================================================================
-- Stockage des fichiers (photos, cartes grises, factures) — bucket privé
-- Chemin : <vehicle_id>/<nom-de-fichier>
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create or replace function public.chemin_voiture(nom text)
returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return (split_part(nom, '/', 1))::uuid;
exception when others then
  return null;
end;
$$;

create policy fichiers_lecture on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (select public.est_membre_voiture(public.chemin_voiture(name))));
create policy fichiers_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (select public.est_membre_voiture(public.chemin_voiture(name))));
create policy fichiers_suppr on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (select public.est_membre_voiture(public.chemin_voiture(name))));
