-- Les fonctions d'aide à la sécurité ne doivent pas être exposées via l'API REST :
-- on les déplace dans un schéma "prive" (non exposé). Les politiques RLS suivent automatiquement.
create schema if not exists prive;
grant usage on schema prive to authenticated;
alter function public.est_famille() set schema prive;
alter function public.est_admin() set schema prive;
alter function public.est_membre_voiture(uuid) set schema prive;
alter function public.chemin_voiture(text) set schema prive;
grant execute on function prive.chemin_voiture(text) to authenticated;

create or replace function public.proteger_profil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
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
