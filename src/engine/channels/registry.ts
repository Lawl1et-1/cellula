/**
 * Visual effect channels: the fixed vocabulary through which scenarios (processes and diseases)
 * alter the living cell. Adding a channel = one entry here + one binding in the scene.
 */
export interface ChannelDef {
  range: readonly [number, number];
  /** Value of the healthy cell. */
  rest: number;
  doc: string;
}

export const CHANNELS = {
  'mitochondria.swelling': { range: [0, 1], rest: 0, doc: 'Gonflement de la matrice' },
  'mitochondria.fragmentation': { range: [0, 1], rest: 0, doc: 'Fission excessive, réseau fragmenté' },
  'mitochondria.potential': { range: [0, 1], rest: 1, doc: 'Potentiel de membrane (lueur)' },
  'mitochondria.cristaeLoss': { range: [0, 1], rest: 0, doc: 'Désorganisation des crêtes' },
  'mitochondria.count': { range: [0, 3], rest: 1, doc: 'Multiplicateur du nombre' },
  'lysosome.storageLoad': { range: [0, 1], rest: 0, doc: 'Matériel non dégradé accumulé' },
  'lysosome.count': { range: [0, 3], rest: 1, doc: 'Multiplicateur du nombre' },
  'er.stress': { range: [0, 1], rest: 0, doc: 'Dilatation du RE, réponse UPR' },
  'er.retainedCargo': { range: [0, 1], rest: 0, doc: 'Protéines retenues dans le RE' },
  'er.replicationOrganelles': { range: [0, 1], rest: 0, doc: 'Vésicules à double membrane virales' },
  'golgi.fragmentation': { range: [0, 1], rest: 0, doc: 'Dispersion des citernes' },
  'golgi.missorting': { range: [0, 1], rest: 0, doc: 'Erreurs de tri vers les lysosomes' },
  'peroxisome.count': { range: [0, 3], rest: 1, doc: 'Multiplicateur du nombre' },
  'peroxisome.empty': { range: [0, 1], rest: 0, doc: 'Peroxysomes « fantômes » sans enzymes' },
  'cytoplasm.aggregates': { range: [0, 1], rest: 0, doc: 'Agrégats protéiques cytoplasmiques' },
  'cytoplasm.lipidDroplets': { range: [0, 1], rest: 0, doc: 'Gouttelettes lipidiques' },
  'cytoplasm.glycogen': { range: [0, 1], rest: 0, doc: 'Granules de glycogène' },
  'cytoplasm.viralParticles': { range: [0, 1], rest: 0, doc: 'Particules virales' },
  'cytoplasm.bacteria': { range: [0, 1], rest: 0, doc: 'Bactéries intracellulaires' },
  'cytoplasm.tint': { range: [0, 1], rest: 0, doc: 'Altération globale de la couleur (souffrance)' },
  'nucleus.envelopeBlebbing': { range: [0, 1], rest: 0, doc: "Déformation de l'enveloppe nucléaire" },
  'nucleus.chromatinCondensation': { range: [0, 1], rest: 0, doc: 'Condensation de la chromatine' },
  'nucleus.inclusions': { range: [0, 1], rest: 0, doc: 'Inclusions intranucléaires' },
  'nucleus.fragmentation': { range: [0, 1], rest: 0, doc: 'Fragmentation (caryorrhexie)' },
  'nucleus.size': { range: [0.5, 2], rest: 1, doc: 'Taille relative du noyau' },
  'membrane.blebbing': { range: [0, 1], rest: 0, doc: 'Bourgeonnement de la membrane' },
  'membrane.receptorDensity': { range: [0, 4], rest: 1, doc: 'Densité de récepteurs' },
  'membrane.integrity': { range: [0, 1], rest: 1, doc: 'Intégrité de la membrane' },
  'cytoskeleton.disruption': { range: [0, 1], rest: 0, doc: 'Désorganisation du cytosquelette' },
  'cytoskeleton.actinTails': { range: [0, 1], rest: 0, doc: "Comètes d'actine (bactéries)" },
  'cell.divisionRate': { range: [0, 5], rest: 1, doc: 'Vitesse de division' },
  'cell.shrinkage': { range: [0, 1], rest: 0, doc: 'Rétraction cellulaire (apoptose)' },
  'cell.viability': { range: [0, 1], rest: 1, doc: '1 = saine, 0 = mort cellulaire' },
} as const satisfies Record<string, ChannelDef>;

export type ChannelIdT = keyof typeof CHANNELS;
export const CHANNEL_IDS = Object.keys(CHANNELS) as [ChannelIdT, ...ChannelIdT[]];
