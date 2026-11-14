// Types d'intervention proposés dans la grille « Qu'est-ce qui a été fait ? »
export const TYPES_INTERVENTION = [
  { code: 'revision', label: 'Révision', icone: '🔧' },
  { code: 'vidange', label: 'Vidange', icone: '🛢️' },
  { code: 'plaquettes_av', label: 'Plaquettes AV', icone: '🛑', piece: { categorie: 'plaquettes', position: 'av' } },
  { code: 'plaquettes_ar', label: 'Plaquettes AR', icone: '🛑', piece: { categorie: 'plaquettes', position: 'ar' } },
  { code: 'disques_av', label: 'Disques AV', icone: '💿', piece: { categorie: 'disques', position: 'av' } },
  { code: 'disques_ar', label: 'Disques AR', icone: '💿', piece: { categorie: 'disques', position: 'ar' } },
  { code: 'essuie_glaces', label: 'Essuie-glaces', icone: '🌧️', piece: { categorie: 'balais', position: 'av' } },
  { code: 'batterie', label: 'Batterie', icone: '🔋', piece: { categorie: 'batterie', position: null } },
  { code: 'pneus', label: 'Pneus', icone: '🛞' },
  { code: 'courroie', label: 'Distribution', icone: '⚙️' },
  { code: 'filtres', label: 'Filtres', icone: '🌀' },
  { code: 'controle_technique', label: 'Contrôle technique', icone: '📋' },
  { code: 'autre', label: 'Autre', icone: '➕' },
]

export const LIBELLE_TYPE = Object.fromEntries([
  ...TYPES_INTERVENTION.map((t) => [t.code, t.label]),
  ['changement_saison', 'Changement de saison'],
])
export const ICONE_TYPE = Object.fromEntries([
  ...TYPES_INTERVENTION.map((t) => [t.code, t.icone]),
  ['changement_saison', '🔄'],
])

export const SAISONS = { ete: 'Été', hiver: 'Hiver', '4saisons': '4 saisons' }
export const ETATS_PNEU = [
  { code: 'neuf', label: 'Neuf', couleur: 'bg-emerald-500' },
  { code: 'mi_use', label: 'Mi-usé', couleur: 'bg-amber-500' },
  { code: 'a_changer', label: 'À changer', couleur: 'bg-red-500' },
]

// Fiche pièces : lignes proposées par défaut
export const CATEGORIES_PIECES = [
  { categorie: 'plaquettes', position: 'av', label: 'Plaquettes avant' },
  { categorie: 'plaquettes', position: 'ar', label: 'Plaquettes arrière' },
  { categorie: 'disques', position: 'av', label: 'Disques avant' },
  { categorie: 'disques', position: 'ar', label: 'Disques arrière' },
  { categorie: 'filtre_huile', position: null, label: 'Filtre à huile' },
  { categorie: 'filtre_air', position: null, label: 'Filtre à air' },
  { categorie: 'filtre_habitacle', position: null, label: 'Filtre habitacle' },
  { categorie: 'filtre_carburant', position: null, label: 'Filtre carburant' },
  { categorie: 'balais', position: 'av', label: 'Balais essuie-glace avant' },
  { categorie: 'balais', position: 'ar', label: 'Balai essuie-glace arrière' },
  { categorie: 'batterie', position: null, label: 'Batterie' },
  { categorie: 'huile', position: null, label: 'Huile moteur (norme / viscosité)' },
]

export const TYPES_DOCUMENT = {
  carte_grise: 'Carte grise',
  assurance: 'Assurance',
  controle_technique: 'Contrôle technique',
  facture: 'Facture',
  autre: 'Autre',
}

/** Liens de recherche chez les marchands (la référence est ajoutée à la fin). */
export const MARCHANDS = [
  { nom: 'Oscaro', url: (r) => `https://www.oscaro.com/recherche?q=${encodeURIComponent(r)}` },
  { nom: 'Mister Auto', url: (r) => `https://www.mister-auto.com/nwsearch/?keywords=${encodeURIComponent(r)}` },
  { nom: 'Amazon', url: (r) => `https://www.amazon.fr/s?k=${encodeURIComponent(r)}` },
]
export const lienPneus = (dimension) =>
  `https://www.allopneus.com/liste/pneu-auto?q=${encodeURIComponent(dimension)}`
