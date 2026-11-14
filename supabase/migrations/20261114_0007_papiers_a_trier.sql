-- Bouton « J'ai un papier » : un papier photographié peut attendre dans la pile « À trier »
-- (voiture pas encore identifiée, champs lus gardés) jusqu'à ce que l'admin le complète.

alter table public.documents alter column vehicle_id drop not null;
alter table public.documents
  add column a_trier boolean not null default false,
  add column lecture jsonb,                 -- ce que la lecture a trouvé (type de papier, date, km, montant…)
  add column trie_le timestamptz,           -- rempli quand l'admin a traité le papier
  add column vu_par_auteur boolean not null default false; -- retour « ta facture a été rangée » déjà affiché

create index documents_a_trier_idx on public.documents (created_at) where a_trier;
create index documents_retour_idx on public.documents (auteur_id) where trie_le is not null and not vu_par_auteur;

-- Toute la famille voit tous les papiers (comme les voitures), y compris ceux sans voiture
drop policy docs_lecture on public.documents;
drop policy docs_ajout on public.documents;
drop policy docs_maj on public.documents;
drop policy docs_suppr on public.documents;
create policy docs_lecture on public.documents for select to authenticated using ((select prive.est_famille()));
create policy docs_ajout on public.documents for insert to authenticated with check ((select prive.est_famille()));
create policy docs_maj on public.documents for update to authenticated
  using ((select prive.est_famille())) with check ((select prive.est_famille()));
create policy docs_suppr on public.documents for delete to authenticated
  using ((select prive.est_famille()) and (auteur_id = (select auth.uid()) or (select prive.est_admin())));

-- Fichiers : dossier d'une voiture, ou dossier « a-trier » quand la voiture n'est pas encore connue
drop policy fichiers_lecture on storage.objects;
drop policy fichiers_ajout on storage.objects;
drop policy fichiers_suppr on storage.objects;
create policy fichiers_lecture on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (
    (select prive.est_membre_voiture(prive.chemin_voiture(name)))
    or (split_part(name, '/', 1) = 'a-trier' and (select prive.est_famille()))));
create policy fichiers_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (
    (select prive.est_membre_voiture(prive.chemin_voiture(name)))
    or (split_part(name, '/', 1) = 'a-trier' and (select prive.est_famille()))));
create policy fichiers_suppr on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (
    (select prive.est_membre_voiture(prive.chemin_voiture(name)))
    or (split_part(name, '/', 1) = 'a-trier' and (select prive.est_famille()))));
