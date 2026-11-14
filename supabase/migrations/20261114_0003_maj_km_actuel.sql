-- Le kilométrage actuel de la voiture suit automatiquement le plus grand km saisi
create or replace function public.maj_km_actuel()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.km is not null then
    update public.vehicles
    set km_actuel = new.km
    where id = new.vehicle_id and (km_actuel is null or km_actuel < new.km);
  end if;
  return new;
end;
$$;
revoke execute on function public.maj_km_actuel() from public, anon, authenticated;

create trigger events_maj_km after insert or update of km on public.events
  for each row execute function public.maj_km_actuel();
create trigger mileage_maj_km after insert on public.mileage_readings
  for each row execute function public.maj_km_actuel();
create trigger checks_maj_km after insert on public.monthly_checks
  for each row execute function public.maj_km_actuel();
