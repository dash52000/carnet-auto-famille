-- Une invitation faite par un membre non-admin doit pouvoir activer un compte déjà inscrit
create or replace function public.activer_invite()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('carnet.activation_invitation', 'on', true);
  update public.profiles set est_membre = true where email = new.email and not est_membre;
  perform set_config('carnet.activation_invitation', 'off', true);
  return new;
end;
$$;
revoke execute on function public.activer_invite() from public, anon, authenticated;

create or replace function public.proteger_profil()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- activation par invitation : seul est_membre passe à true, rien d'autre
  if coalesce(current_setting('carnet.activation_invitation', true), 'off') = 'on'
     and new.est_membre and not old.est_membre
     and new.est_admin is not distinct from old.est_admin
     and new.email is not distinct from old.email then
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
