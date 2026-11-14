-- Approximations et réponses « je ne sais pas » (moins de friction à la saisie).

-- Dates et km approximatifs (« il y a ~1 an », « ~85 000 km »)
alter table public.events
  add column date_approx boolean not null default false,
  add column km_approx boolean not null default false;
alter table public.mileage_readings
  add column km_approx boolean not null default false;

-- Infos que la famille ne connaît pas : réponse acceptée, l'app ne les redemande plus.
-- Clés : km, revision, ct, assurance, pneus, garage
alter table public.vehicles
  add column km_actuel_approx boolean not null default false,
  add column inconnus text[] not null default '{}';

-- État des pneus inconnu
alter table public.tyre_sets drop constraint tyre_sets_etat_check;
alter table public.tyre_sets
  add constraint tyre_sets_etat_check check (etat in ('neuf', 'mi_use', 'a_changer', 'inconnu'));

-- Ligne « info » dans le fil d'activité (« Maman a renseigné l'assurance »)
alter table public.events drop constraint events_type_check;
alter table public.events
  add constraint events_type_check check (type in (
    'revision', 'vidange', 'plaquettes_av', 'plaquettes_ar', 'disques_av', 'disques_ar',
    'essuie_glaces', 'batterie', 'pneus', 'courroie', 'filtres', 'controle_technique',
    'changement_saison', 'autre', 'info'
  ));

-- Kilométrage actuel : un relevé exact remplace toujours une approximation ;
-- une approximation ne remplace jamais un relevé exact.
create or replace function public.maj_km_actuel()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  approx boolean := coalesce((to_jsonb(new) ->> 'km_approx')::boolean, false);
begin
  if new.km is null then
    return new;
  end if;
  if approx then
    update public.vehicles
    set km_actuel = new.km, km_actuel_approx = true
    where id = new.vehicle_id and (km_actuel is null or km_actuel_approx);
  else
    update public.vehicles
    set km_actuel = new.km, km_actuel_approx = false
    where id = new.vehicle_id and (km_actuel is null or km_actuel_approx or km_actuel < new.km);
  end if;
  return new;
end;
$$;
revoke execute on function public.maj_km_actuel() from public, anon, authenticated;
