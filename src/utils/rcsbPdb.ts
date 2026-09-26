import { MoleculeStructure } from '../types/gromacs';
import { parsePDB } from './pdbParser';
import { analyzeChainsAndLigands, SeparationAnalysis } from './structureSeparation';

export interface PdbBenchmark {
  id: string;
  name: string;
  category: 'Enzyme' | 'Virus Target' | 'Signaling' | 'Drug Target' | 'Membrane' | 'Nucleic Acid';
  resolution: string;
  organism: string;
  description: string;
  hasLigand: boolean;
  ligandName?: string;
  dockingScore?: number;
}

export const POPULAR_PDB_BENCHMARKS: PdbBenchmark[] = [
  {
    id: '6LU7',
    name: 'SARS-CoV-2 Main Protease (Mpro) + N3 Inhibitor',
    category: 'Virus Target',
    resolution: '2.16 Å',
    organism: 'SARS-CoV-2',
    description: 'Crucial viral cysteine protease in complex with peptide-like covalent inhibitor N3. Benchmark for antiviral drug design and CB-Dock MD.',
    hasLigand: true,
    ligandName: 'N3',
    dockingScore: -9.4,
  },
  {
    id: '1AKI',
    name: 'Hen Egg-White Lysozyme',
    category: 'Enzyme',
    resolution: '1.50 Å',
    organism: 'Gallus gallus',
    description: 'The definitive textbook GROMACS tutorial benchmark protein with 129 residues and 4 disulfide bonds.',
    hasLigand: false,
  },
  {
    id: '1UBQ',
    name: 'Human Ubiquitin',
    category: 'Signaling',
    resolution: '1.80 Å',
    organism: 'Homo sapiens',
    description: 'Compact 76-residue regulatory protein with mixed alpha/beta fold, ideal for rapid equilibration testing.',
    hasLigand: false,
  },
  {
    id: '6M0J',
    name: 'SARS-CoV-2 Spike RBD bound with ACE2',
    category: 'Virus Target',
    resolution: '2.45 Å',
    organism: 'SARS-CoV-2 / Homo sapiens',
    description: 'Complex of viral spike glycoprotein receptor-binding domain with host ACE2 receptor.',
    hasLigand: false,
  },
  {
    id: '4DFR',
    name: 'E. coli Dihydrofolate Reductase + Methotrexate',
    category: 'Drug Target',
    resolution: '1.70 Å',
    organism: 'Escherichia coli',
    description: 'Classic anticancer / antibacterial target complexed with methotrexate and NADPH.',
    hasLigand: true,
    ligandName: 'MTX',
    dockingScore: -8.9,
  },
  {
    id: '1MBN',
    name: 'Sperm Whale Myoglobin + Heme',
    category: 'Enzyme',
    resolution: '2.00 Å',
    organism: 'Physeter catodon',
    description: 'Historic first protein 3D structure solved by Kendrew (1958). High alpha-helical content and iron-protoporphyrin IX.',
    hasLigand: true,
    ligandName: 'HEM',
    dockingScore: -11.2,
  },
  {
    id: '3PBL',
    name: 'Dopamine D3 Receptor + Eticlopride',
    category: 'Membrane',
    resolution: '3.15 Å',
    organism: 'Homo sapiens',
    description: 'Human G-protein coupled receptor (GPCR) target with high affinity antipsychotic ligand.',
    hasLigand: true,
    ligandName: 'ETQ',
    dockingScore: -10.1,
  },
  {
    id: '1BNA',
    name: 'B-DNA Dodecamer (CGCGAATTCGCG)',
    category: 'Nucleic Acid',
    resolution: '1.90 Å',
    organism: 'Synthetic DNA',
    description: 'Standard Drew-Dickerson B-form double helix benchmark for force field nucleic acid parameters.',
    hasLigand: false,
  }
];

export interface RcsbMetadata {
  title?: string;
  resolution?: number;
  experimentalMethod?: string;
  depositionDate?: string;
  releaseDate?: string;
  organism?: string;
  pubmedId?: string;
  doi?: string;
  polymerCount?: number;
  ligands?: string[];
}

export interface PdbSearchHit {
  id: string;
  title: string;
  resolution?: string;
  organism?: string;
  experimentalMethod?: string;
  ligands?: string[];
  polymerCount?: number;
  isBenchmark?: boolean;
}

/**
 * Fetch structure coordinates and metadata directly from the RCSB Protein Data Bank.
 * Supports direct 4-character PDB code (e.g. "6LU7", "1AKI") OR direct name search (e.g. "SARS-CoV-2 main protease").
 */
export async function fetchPdbFromRcsb(rawInput: string): Promise<{
  structure: MoleculeStructure;
  pdbText: string;
  metadata: RcsbMetadata;
  separationAnalysis: SeparationAnalysis;
}> {
  let cleanInput = rawInput.trim();
  if (!cleanInput) {
    throw new Error('Please enter a PDB ID (e.g. 6LU7, 1AKI) or protein name (e.g. Lysozyme, Protease)');
  }

  let cleanId = cleanInput.toUpperCase();
  const isDirectPdbId = /^[0-9][A-Z0-9]{3}$/.test(cleanId) || /^[A-Z0-9]{4}$/.test(cleanId);

  // If input is not a 4-char PDB ID, resolve it by searching RCSB or benchmarks
  if (!isDirectPdbId) {
    const hits = await searchRcsbPdbDetailed(cleanInput);
    if (!hits || hits.length === 0) {
      throw new Error(`No Protein Data Bank structures found for query "${cleanInput}". Please try a PDB ID (e.g. 6LU7) or different name.`);
    }
    cleanId = hits[0].id.toUpperCase();
  }

  // 1. Fetch metadata in parallel with structure
  const metadataPromise = fetch(`https://data.rcsb.org/rest/v1/core/entry/${cleanId}`)
    .then(async (res) => {
      if (!res.ok) return null;
      return res.json();
    })
    .catch(() => null);

  // 2. Fetch PDB coordinates file
  const pdbUrl = `https://files.rcsb.org/download/${cleanId}.pdb`;
  const pdbResponse = await fetch(pdbUrl);

  if (!pdbResponse.ok) {
    throw new Error(`Failed to download structure for PDB ID ${cleanId} (HTTP status ${pdbResponse.status}). Please check the code or network.`);
  }

  const pdbText = await pdbResponse.text();

  if (!pdbText || pdbText.length < 100) {
    throw new Error(`Received empty or invalid coordinate data for PDB ID ${cleanId}.`);
  }

  // Parse structure
  const structure = parsePDB(pdbText, `${cleanId}.pdb`);

  // Extract metadata
  const rawMeta = await metadataPromise;
  const metadata: RcsbMetadata = {};

  if (rawMeta) {
    metadata.title = rawMeta.struct?.title || cleanId;
    if (rawMeta.rcsb_entry_info?.resolution_combined?.[0]) {
      metadata.resolution = rawMeta.rcsb_entry_info.resolution_combined[0];
    }
    if (rawMeta.exptl?.[0]?.method) {
      metadata.experimentalMethod = rawMeta.exptl[0].method;
    }
    if (rawMeta.rcsb_accession_info?.deposit_date) {
      metadata.depositionDate = rawMeta.rcsb_accession_info.deposit_date.substring(0, 10);
    }
    if (rawMeta.rcsb_accession_info?.initial_release_date) {
      metadata.releaseDate = rawMeta.rcsb_accession_info.initial_release_date.substring(0, 10);
    }
    if (rawMeta.rcsb_entry_container_identifiers?.polymer_entity_ids) {
      metadata.polymerCount = rawMeta.rcsb_entry_container_identifiers.polymer_entity_ids.length;
    }
    if (rawMeta.rcsb_entry_container_identifiers?.non_polymer_entity_ids) {
      metadata.ligands = rawMeta.rcsb_entry_container_identifiers.non_polymer_entity_ids;
    }
  }

  // Attach metadata to structure
  structure.pdbId = cleanId;
  structure.rawPdbText = pdbText;
  structure.pdbMetadata = metadata;
  if (metadata.title && (!structure.name || structure.name.startsWith('Molecule') || structure.name === `${cleanId}.pdb`)) {
    structure.name = `${cleanId}: ${metadata.title.length > 50 ? metadata.title.slice(0, 50) + '...' : metadata.title}`;
  }

  // Perform chain and ligand separation analysis
  const separationAnalysis = analyzeChainsAndLigands(structure);
  structure.separationInfo = {
    favorableChainID: separationAnalysis.favorableChainID,
    favorableLigandResName: separationAnalysis.favorableLigandResName,
    summaryRecommendation: separationAnalysis.summaryRecommendation,
    chainsCount: separationAnalysis.chains.length,
    ligandsCount: separationAnalysis.ligands.length,
  };

  return { structure, pdbText, metadata, separationAnalysis };
}

/**
 * Detailed search of RCSB Protein Data Bank by ID or protein name/keyword.
 * Enriches results with real titles, resolutions, organisms, and bound ligands.
 */
export async function searchRcsbPdbDetailed(query: string): Promise<PdbSearchHit[]> {
  const clean = query.trim();
  if (!clean) {
    return POPULAR_PDB_BENCHMARKS.map(b => ({
      id: b.id,
      title: b.name,
      resolution: b.resolution,
      organism: b.organism,
      ligands: b.ligandName ? [b.ligandName] : undefined,
      isBenchmark: true,
    }));
  }

  const resultsMap = new Map<string, PdbSearchHit>();

  // 1. Direct benchmark matching (instant response)
  const qLower = clean.toLowerCase();
  for (const b of POPULAR_PDB_BENCHMARKS) {
    if (
      b.id.toLowerCase().includes(qLower) ||
      b.name.toLowerCase().includes(qLower) ||
      b.description.toLowerCase().includes(qLower) ||
      b.organism.toLowerCase().includes(qLower) ||
      (b.ligandName && b.ligandName.toLowerCase().includes(qLower))
    ) {
      resultsMap.set(b.id, {
        id: b.id,
        title: b.name,
        resolution: b.resolution,
        organism: b.organism,
        ligands: b.ligandName ? [b.ligandName] : undefined,
        isBenchmark: true,
      });
    }
  }

  // 2. If user entered a 4-char PDB ID, ensure it is in the results
  if (/^[0-9][A-Za-z0-9]{3}$/.test(clean) || /^[A-Za-z0-9]{4}$/.test(clean)) {
    const directId = clean.toUpperCase();
    if (!resultsMap.has(directId)) {
      resultsMap.set(directId, {
        id: directId,
        title: `PDB Entry ${directId}`,
      });
    }
  }

  // 3. Query RCSB REST search API for keyword / full-text match
  try {
    const payload = {
      query: {
        type: 'terminal',
        service: 'full_text',
        parameters: {
          value: clean,
        },
      },
      return_type: 'entry',
      request_options: {
        paginate: {
          start: 0,
          rows: 8,
        },
        scoring_strategy: 'combined',
      },
    };

    const res = await fetch('https://search.rcsb.org/rcsbsearch/v2/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      const ids: string[] = (data.result_set || []).map((r: { identifier: string }) => r.identifier);

      for (const id of ids) {
        if (!resultsMap.has(id)) {
          resultsMap.set(id, {
            id,
            title: `PDB Entry ${id}`,
          });
        }
      }
    }
  } catch (err) {
    console.warn('RCSB search query network error', err);
  }

  const candidateList = Array.from(resultsMap.values()).slice(0, 8);

  // 4. Enrich top candidate entries with metadata (title, resolution, organism, ligands) in parallel
  const enrichedList = await Promise.all(
    candidateList.map(async (item) => {
      // If already populated from benchmark, keep it
      if (item.resolution && item.organism && item.isBenchmark) return item;

      try {
        const metaRes = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${item.id}`);
        if (!metaRes.ok) return item;
        const meta = await metaRes.json();

        return {
          ...item,
          title: meta.struct?.title || item.title,
          resolution: meta.rcsb_entry_info?.resolution_combined?.[0]
            ? `${meta.rcsb_entry_info.resolution_combined[0]} Å`
            : item.resolution,
          experimentalMethod: meta.exptl?.[0]?.method || item.experimentalMethod,
          organism: meta.rcsb_entry_container_identifiers?.polymer_entity_ids ? 'Biological Polymer' : undefined,
          ligands: meta.rcsb_entry_container_identifiers?.non_polymer_entity_ids || item.ligands,
        };
      } catch {
        return item;
      }
    })
  );

  return enrichedList;
}

/**
 * Backwards compatible search returning string IDs
 */
export async function searchRcsbPdb(query: string): Promise<string[]> {
  const hits = await searchRcsbPdbDetailed(query);
  return hits.map(h => h.id);
}
