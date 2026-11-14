-- Accès sans email : connexion anonyme Supabase + code famille (contenu dans le lien d'invitation)
alter table public.profiles alter column email drop not null;

create table public.famille (
  id integer primary key default 1 check (id = 1),
  code text not null,
  created_at timestamptz not null default now()
);
alter table public.famille enable row level security;
-- aucune politique : la table n'est lisible que via les fonctions ci-dessous

create or replace function prive.nouveau_code()
returns text
language sql volatile set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 8);
$$;

-- Profil créé à l'inscription (email facultatif, membre seulement après avoir rejoint)
create or replace function public.creer_profil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, est_admin, est_membre)
  values (new.id, lower(new.email), false, false);
  return new;
end;
$$;
revoke execute on function public.creer_profil() from public, anon, authenticated;

-- Les fonctions internes peuvent lever la protection des drapeaux du profil
create or replace function public.proteger_profil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(current_setting('carnet.modif_systeme', true), 'off') = 'on' then
    return new;
  end if;
  if (new.est_admin is distinct from old.est_admin or new.est_membre is distinct from old.est_membre
      or new.email is distinct from old.email)
     and not prive.est_admin()
     and (select auth.uid()) is not null then
    raise exception 'Seul un admin peut modifier ces informations';
  end if;
  return new;
end;
$$;
revoke execute on function public.proteger_profil() from public, anon, authenticated;

-- Rejoindre la famille. Le tout premier à rejoindre crée la famille et devient admin.
create or replace function public.rejoindre_famille(p_code text, p_prenom text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  premier boolean;
begin
  if uid is null then
    raise exception 'Non connecté';
  end if;
  if coalesce(trim(p_prenom), '') = '' then
    raise exception 'Prénom manquant';
  end if;
  select not exists (select 1 from public.profiles where est_membre) into premier;
  if premier then
    insert into public.famille (id, code) values (1, prive.nouveau_code())
    on conflict (id) do nothing;
  elsif not exists (select 1 from public.famille f where f.code = upper(trim(coalesce(p_code, '')))) then
    raise exception 'Code famille incorrect';
  end if;
  perform set_config('carnet.modif_systeme', 'on', true);
  update public.profiles
  set est_membre = true, est_admin = (est_admin or premier), prenom = trim(p_prenom)
  where id = uid;
  perform set_config('carnet.modif_systeme', 'off', true);
  return premier;
end;
$$;

create or replace function public.code_famille()
returns text
language sql stable security definer set search_path = ''
as $$
  select f.code from public.famille f where prive.est_famille();
$$;

create or replace function public.regenerer_code_famille()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  c text;
begin
  if not prive.est_admin() then
    raise exception 'Réservé aux admins';
  end if;
  c := prive.nouveau_code();
  update public.famille set code = c where id = 1;
  return c;
end;
$$;

revoke execute on function public.rejoindre_famille(text, text) from public, anon;
revoke execute on function public.code_famille() from public, anon;
revoke execute on function public.regenerer_code_famille() from public, anon;
grant execute on function public.rejoindre_famille(text, text) to authenticated;
grant execute on function public.code_famille() to authenticated;
grant execute on function public.regenerer_code_famille() to authenticated;

-- Toute la famille voit toutes les voitures (les comptes sont liés à un appareil,
-- le partage voiture par voiture serait trop fragile)
create or replace function prive.est_membre_voiture(v uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select v is not null and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.est_membre
  );
$$;
