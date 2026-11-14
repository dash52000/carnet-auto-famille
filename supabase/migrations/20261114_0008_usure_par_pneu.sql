-- Usure de chaque pneu d'un jeu (vue de dessus avec 4 pneus cliquables).
-- usure = { "av_g": {"etat": "mi_use", "pct": 40}, "av_d": {...}, "ar_g": {...}, "ar_d": {...} }
--   etat : neuf | mi_use | a_changer | inconnu ; pct : usure estimée en % (facultatif, 0 = neuf, 100 = lisse)
-- L'usure suit le jeu (au box comme monté). tyre_sets.etat reste l'état global du jeu
-- (pastille, alertes) : c'est le pire des 4 pneus, recalculé ici dès que l'usure change.

alter table public.tyre_sets
  add column usure jsonb check (usure is null or jsonb_typeof(usure) = 'object');

create or replace function prive.etat_jeu_depuis_usure()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  etats text[];
begin
  if new.usure is null then
    return new;
  end if;
  select array_agg(v ->> 'etat') into etats from jsonb_each(new.usure) as t(k, v);
  new.etat := case
    when 'a_changer' = any(etats) then 'a_changer'
    when 'mi_use' = any(etats) then 'mi_use'
    when 'neuf' = any(etats) then 'neuf'
    else 'inconnu'
  end;
  return new;
end;
$$;
revoke execute on function prive.etat_jeu_depuis_usure() from public, anon, authenticated;

create trigger tyre_sets_etat_depuis_usure before insert or update of usure on public.tyre_sets
  for each row execute function prive.etat_jeu_depuis_usure();
