export interface Atom {
  id: number;
  name: string;
  resName: string;
  resSeq: number;
  chainID: string;
  x: number; // in Angstroms
  y: number;
  z: number;
  occupancy?: number;
  tempFactor?: number;
  element: string;
  charge?: number;
  isBackbone?: boolean;
}

export interface Residue {
  seq: number;
  name: string;
  chain: string;
  atoms: Atom[];
  secondaryStructure?: 'helix' | 'sheet' | 'coil';
  phi?: number;
  psi?: number;
}

export interface MoleculeStructure {
  name: string;
  filename: string;
  atoms: Atom[];
  residues: Residue[];
  chains: string[];
  box?: {
    x: number;
    y: number;
    z: number;
    alpha?: number;
    beta?: number;
    gamma?: number;
    type?: 'cubic' | 'triclinic' | 'dodecahedron';
  };
  totalCharge: number;
  numAtoms: number;
  numResidues: number;
  massApprox: number; // kDa
}

export type ForceField = 'amber99sb-ildn' | 'charmm36m' | 'oplsaa' | 'gromos54a7';
export type WaterModel = 'tip3p' | 'spce' | 'tip4p' | 'opc';
export type BoxShape = 'cubic' | 'dodecahedron' | 'triclinic' | 'octahedron';

export interface MdpConfig {
  stage: 'minim' | 'nvt' | 'npt' | 'prod';
  integrator: string;
  nsteps: number;
  dt: number; // ps
  emtol?: number; // kJ/(mol nm)
  emstep?: number;
  nstxout?: number;
  nstvout?: number;
  nstenergy: number;
  nstlog: number;
  cutoff_scheme: 'Verlet' | 'group';
  nstlist: number;
  ns_type: 'grid' | 'simple';
  rlist: number;
  coulombtype: 'PME' | 'Cut-off' | 'Reaction-Field';
  rcoulomb: number;
  vdwtype: 'Cut-off' | 'PME';
  rvdw: number;
  pme_order?: number;
  fourierspacing?: number;
  tcoupl: 'v-rescale' | 'berendsen' | 'nose-hoover' | 'no';
  ref_t: number; // Kelvin
  tau_t: number; // ps
  pcoupl?: 'Parrinello-Rahman' | 'Berendsen' | 'c-rescale' | 'no';
  pcoupltype?: 'isotropic' | 'semiisotropic' | 'anisotropic';
  ref_p?: number; // bar
  tau_p?: number; // ps
  compressibility?: number;
  constraints: 'none' | 'h-bonds' | 'all-bonds';
  constraint_algorithm: 'LINCS' | 'SHAKE';
  gen_vel: boolean;
  gen_temp?: number;
  gen_seed?: number;
  continuation?: boolean;
}

export interface SimulationProtocol {
  systemName: string;
  forceField: ForceField;
  waterModel: WaterModel;
  boxShape: BoxShape;
  boxPadding: number; // nm
  saltConcentration: number; // M
  neutralize: boolean;
  temperature: number; // K
  pressure: number; // bar
  minimSteps: number;
  nvtLengthPs: number;
  nptLengthPs: number;
  prodLengthNs: number;
  timeStepFs: number;
  pmeCutoff: number; // nm
  pullCodeEnabled: boolean;
  gpuAcceleration: boolean;
}

export interface XvgSeries {
  id: string;
  title: string;
  xLabel: string;
  yLabel: string;
  data: { x: number; y: number }[];
  unitX: string;
  unitY: string;
  stats?: {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
  };
}

export type SimulationEngine = 'gromacs' | 'lammps' | 'comparative';
export type LammpsUnits = 'real' | 'metal' | 'lj' | 'si';
export type LammpsAtomStyle = 'full' | 'atomic' | 'charge' | 'molecular';

export interface LammpsProtocol {
  systemName: string;
  units: LammpsUnits;
  atomStyle: LammpsAtomStyle;
  boundary: string;
  pairStyle: string;
  pairCoeff: string;
  kspaceStyle: string;
  temperature: number; // K
  pressure: number; // bar or atm
  timeStep: number; // fs or ps based on units
  runSteps: number;
  thermoFreq: number;
  dumpFreq: number;
  ensemble: 'nvt' | 'npt' | 'nve';
  minimization: boolean;
  gpuAcceleration: boolean;
}

export interface ComparativeEngineInfo {
  category: string;
  gromacs: string;
  lammps: string;
  recommendation: 'gromacs' | 'lammps' | 'both';
  notes: string;
}

export interface GromacsFile {
  name: string;
  size: number;
  type: 'structure' | 'topology' | 'parameter' | 'trajectory' | 'analysis' | 'log' | 'lammps_input' | 'lammps_data' | 'other';
  engine?: 'gromacs' | 'lammps' | 'universal';
  content: string;
  lastModified: number;
  parsedSummary?: string;
}

