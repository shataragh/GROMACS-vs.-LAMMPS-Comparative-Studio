import { parsePDB } from './pdbParser';
import { MoleculeStructure, XvgSeries } from '../types/gromacs';

// Accurate representative coordinate sets for canonical molecular benchmark systems
export const ALANINE_DIPEPTIDE_PDB = `HEADER    PEPTIDE                                 25-SEP-26   ALAD
COMPND    MOL_ID: 1; MOLECULE: ACE-ALA-NME; CHAIN: A;
CRYST1   30.000   30.000   30.000  90.00  90.00  90.00 P 1           1
ATOM      1  CH3 ACE A   1       2.000   1.000   0.000  1.00  0.00           C  
ATOM      2  C   ACE A   1       1.500   2.400   0.000  1.00  0.00           C  
ATOM      3  O   ACE A   1       2.250   3.380   0.000  1.00  0.00           O  
ATOM      4 1HH3 ACE A   1       1.650   0.490   0.900  1.00  0.00           H  
ATOM      5 2HH3 ACE A   1       1.650   0.490  -0.900  1.00  0.00           H  
ATOM      6 3HH3 ACE A   1       3.090   1.000   0.000  1.00  0.00           H  
ATOM      7  N   ALA A   2       0.170   2.500   0.000  1.00  0.00           N  
ATOM      8  H   ALA A   2      -0.350   1.640   0.000  1.00  0.00           H  
ATOM      9  CA  ALA A   2      -0.560   3.760   0.000  1.00  0.00           C  
ATOM     10  HA  ALA A   2      -0.340   4.340   0.890  1.00  0.00           H  
ATOM     11  CB  ALA A   2      -2.060   3.480   0.000  1.00  0.00           C  
ATOM     12 1HB  ALA A   2      -2.310   2.910   0.890  1.00  0.00           H  
ATOM     13 2HB  ALA A   2      -2.310   2.910  -0.890  1.00  0.00           H  
ATOM     14 3HB  ALA A   2      -2.580   4.440   0.000  1.00  0.00           H  
ATOM     15  C   ALA A   2      -0.150   4.620  -1.200  1.00  0.00           C  
ATOM     16  O   ALA A   2       1.030   4.960  -1.370  1.00  0.00           O  
ATOM     17  N   NME A   3      -1.120   4.960  -2.050  1.00  0.00           N  
ATOM     18  H   NME A   3      -2.070   4.640  -1.870  1.00  0.00           H  
ATOM     19  CH3 NME A   3      -0.840   5.800  -3.210  1.00  0.00           C  
ATOM     20 1HH3 NME A   3       0.230   5.990  -3.260  1.00  0.00           H  
ATOM     21 2HH3 NME A   3      -1.360   6.750  -3.110  1.00  0.00           H  
ATOM     22 3HH3 NME A   3      -1.180   5.280  -4.110  1.00  0.00           H  
TER      23      NME A   3
END
`;

// Representative 1AKI Lysozyme Backbone Coordinates snippet
export const LYSOZYME_1AKI_PDB = `HEADER    HYDROLASE                               19-NOV-91   1AKI              
TITLE     STRUCTURE OF HEN EGG-WHITE LYSOZYME                                   
CRYST1   79.100   79.100   37.900  90.00  90.00  90.00 P 43 21 2     8          
ATOM      1  N   LYS A   1      25.680  20.670  16.140  1.00 13.91           N  
ATOM      2  CA  LYS A   1      26.060  21.980  16.710  1.00 12.87           C  
ATOM      3  C   LYS A   1      25.290  23.080  15.990  1.00 11.23           C  
ATOM      4  O   LYS A   1      25.750  24.230  15.900  1.00 12.02           O  
ATOM      5  CB  LYS A   1      27.580  22.180  16.630  1.00 15.34           C  
ATOM      6  N   VAL A   2      24.130  22.750  15.440  1.00  9.78           N  
ATOM      7  CA  VAL A   2      23.270  23.750  14.810  1.00  9.88           C  
ATOM      8  C   VAL A   2      22.210  24.260  15.780  1.00 10.12           C  
ATOM      9  O   VAL A   2      22.090  25.470  16.000  1.00 10.30           O  
ATOM     10  CB  VAL A   2      22.610  23.190  13.520  1.00 10.42           C  
ATOM     11  N   PHE A   3      21.430  23.340  16.350  1.00 10.02           N  
ATOM     12  CA  PHE A   3      20.360  23.680  17.280  1.00 11.45           C  
ATOM     13  C   PHE A   3      20.880  24.620  18.370  1.00 10.99           C  
ATOM     14  O   PHE A   3      20.310  25.680  18.610  1.00 11.89           O  
ATOM     15  CB  PHE A   3      19.160  24.310  16.540  1.00 11.51           C  
ATOM     16  N   GLY A   4      21.960  24.210  19.030  1.00 11.20           N  
ATOM     17  CA  GLY A   4      22.560  25.020  20.090  1.00 11.40           C  
ATOM     18  C   GLY A   4      23.100  26.340  19.560  1.00 10.97           C  
ATOM     19  O   GLY A   4      22.840  27.400  20.130  1.00 11.82           O  
ATOM     20  N   ARG A   5      23.850  26.270  18.460  1.00 10.87           N  
ATOM     21  CA  ARG A   5      24.420  27.460  17.840  1.00 11.40           C  
ATOM     22  C   ARG A   5      23.360  28.460  17.380  1.00 11.32           C  
ATOM     23  O   ARG A   5      23.490  29.680  17.550  1.00 11.55           O  
ATOM     24  CB  ARG A   5      25.390  27.050  16.710  1.00 12.39           C  
ATOM     25  N   CYS A   6      22.310  27.950  16.750  1.00 11.84           N  
ATOM     26  CA  CYS A   6      21.230  28.800  16.250  1.00 12.01           C  
ATOM     27  C   CYS A   6      20.250  29.170  17.360  1.00 12.44           C  
ATOM     28  O   CYS A   6      19.890  30.340  17.520  1.00 13.88           O  
ATOM     29  CB  CYS A   6      20.500  28.100  15.090  1.00 12.40           C  
ATOM     30  SG  CYS A   6      21.520  27.840  13.620  1.00 14.50           S  
ATOM     31  N   GLU A   7      19.820  28.170  18.130  1.00 12.51           N  
ATOM     32  CA  GLU A   7      18.890  28.400  19.220  1.00 13.11           C  
ATOM     33  C   GLU A   7      19.530  29.240  20.310  1.00 13.20           C  
ATOM     34  O   GLU A   7      18.850  30.070  20.910  1.00 14.50           O  
ATOM     35  CB  GLU A   7      18.420  27.070  19.810  1.00 14.54           C  
ATOM     36  N   LEU A   8      20.820  29.020  20.570  1.00 12.82           N  
ATOM     37  CA  LEU A   8      21.520  29.770  21.600  1.00 13.10           C  
ATOM     38  C   LEU A   8      21.670  31.240  21.220  1.00 13.43           C  
ATOM     39  O   LEU A   8      21.500  32.130  22.050  1.00 14.81           O  
ATOM     40  CB  LEU A   8      22.910  29.170  21.860  1.00 13.72           C  
ATOM     41  N   ALA A   9      21.990  31.480  19.950  1.00 13.23           N  
ATOM     42  CA  ALA A   9      22.180  32.840  19.460  1.00 13.75           C  
ATOM     43  C   ALA A   9      20.890  33.650  19.450  1.00 14.54           C  
ATOM     44  O   ALA A   9      20.930  34.880  19.470  1.00 15.34           O  
ATOM     45  CB  ALA A   9      22.840  32.820  18.080  1.00 13.84           C  
ATOM     46  N   ALA A  10      19.750  32.960  19.430  1.00 14.78           N  
ATOM     47  CA  ALA A  10      18.450  33.620  19.400  1.00 15.54           C  
ATOM     48  C   ALA A  10      17.840  33.720  20.800  1.00 16.32           C  
ATOM     49  O   ALA A  10      16.910  34.500  21.030  1.00 16.94           O  
ATOM     50  CB  ALA A  10      17.480  32.850  18.500  1.00 15.59           C  
ATOM     51  N   ALA A  11      18.370  32.930  21.730  1.00 17.06           N  
ATOM     52  CA  ALA A  11      17.860  32.930  23.100  1.00 17.82           C  
ATOM     53  C   ALA A  11      18.660  33.860  24.010  1.00 18.23           C  
ATOM     54  O   ALA A  11      18.170  34.420  25.000  1.00 19.34           O  
ATOM     55  CB  ALA A  11      17.870  31.520  23.680  1.00 18.24           C  
ATOM     56  N   MET A  12      19.910  34.020  23.660  1.00 18.17           N  
ATOM     57  CA  MET A  12      20.760  34.890  24.460  1.00 18.54           C  
ATOM     58  C   MET A  12      20.610  36.350  24.040  1.00 18.73           C  
ATOM     59  O   MET A  12      20.760  37.260  24.860  1.00 19.64           O  
ATOM     60  CB  MET A  12      22.230  34.440  24.360  1.00 19.24           C  
ATOM     61  N   LYS A  13      20.300  36.560  22.760  1.00 18.52           N  
ATOM     62  CA  LYS A  13      20.140  37.910  22.230  1.00 18.91           C  
ATOM     63  C   LYS A  13      18.790  38.500  22.610  1.00 18.72           C  
ATOM     64  O   LYS A  13      18.660  39.720  22.750  1.00 19.38           O  
ATOM     65  CB  LYS A  13      20.310  37.890  20.710  1.00 19.97           C  
TER      66      LYS A  13
END
`;

// Representative Ubiquitin snippet
export const UBIQUITIN_PDB = `HEADER    SIGNALING PROTEIN                       28-SEP-87   1UBQ              
TITLE     STRUCTURE OF UBIQUITIN REFINED AT 1.8 A RESOLUTION                    
CRYST1   50.840   42.770   28.950  90.00  90.00  90.00 P 21 21 21    4          
ATOM      1  N   MET A   1      27.340  24.430   2.610  1.00  9.67           N  
ATOM      2  CA  MET A   1      26.260  25.410   2.840  1.00  9.11           C  
ATOM      3  C   MET A   1      26.910  26.730   3.240  1.00  8.00           C  
ATOM      4  O   MET A   1      27.880  26.740   3.990  1.00  8.94           O  
ATOM      5  CB  MET A   1      25.410  25.600   1.580  1.00 13.00           C  
ATOM      6  N   GLN A   2      26.330  27.850   2.780  1.00  7.50           N  
ATOM      7  CA  GLN A   2      26.850  29.170   3.090  1.00  8.00           C  
ATOM      8  C   GLN A   2      26.160  29.740   4.320  1.00  7.33           C  
ATOM      9  O   GLN A   2      25.260  30.560   4.220  1.00  8.30           O  
ATOM     10  CB  GLN A   2      26.680  30.120   1.900  1.00  8.67           C  
ATOM     11  N   ILE A   3      26.600  29.280   5.480  1.00  7.00           N  
ATOM     12  CA  ILE A   3      26.040  29.740   6.740  1.00  7.67           C  
ATOM     13  C   ILE A   3      26.780  31.000   7.190  1.00  7.33           C  
ATOM     14  O   ILE A   3      27.950  30.980   7.590  1.00  8.33           O  
ATOM     15  CB  ILE A   3      26.120  28.630   7.810  1.00  8.00           C  
ATOM     16  N   PHE A   4      26.080  32.130   7.120  1.00  7.00           N  
ATOM     17  CA  PHE A   4      26.660  33.410   7.510  1.00  7.33           C  
ATOM     18  C   PHE A   4      27.180  33.440   8.940  1.00  7.00           C  
ATOM     19  O   PHE A   4      26.670  32.720   9.800  1.00  8.00           O  
ATOM     20  CB  PHE A   4      25.640  34.540   7.320  1.00  7.67           C  
TER      21      PHE A   4
END
`;

export function getSampleMolecule(type: 'lysozyme' | 'ubiquitin' | 'alanine' | 'graphene' | 'copper'): MoleculeStructure {
  switch (type) {
    case 'lysozyme':
      return parsePDB(LYSOZYME_1AKI_PDB, '1AKI_lysozyme.pdb');
    case 'ubiquitin':
      return parsePDB(UBIQUITIN_PDB, '1UBQ_ubiquitin.pdb');
    case 'graphene':
      return generateGrapheneStructure();
    case 'copper':
      return generateCopperLattice();
    case 'alanine':
    default:
      return parsePDB(ALANINE_DIPEPTIDE_PDB, 'alanine_dipeptide.pdb');
  }
}

// Generate Graphene Nanoribbon (LAMMPS Carbon benchmark)
function generateGrapheneStructure(): MoleculeStructure {
  const atoms: MoleculeStructure['atoms'] = [];
  const a = 1.42; // C-C bond length in Angstroms
  let id = 1;

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 12; col++) {
      const x = col * Math.sqrt(3) * a + (row % 2 === 1 ? (Math.sqrt(3) * a) / 2 : 0);
      const y = row * 1.5 * a;
      const z = 0;

      atoms.push({
        id: id++,
        name: `C${id}`,
        resName: 'GRPH',
        resSeq: 1,
        chainID: 'A',
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        z,
        element: 'C',
        charge: 0,
        isBackbone: false,
      });
    }
  }

  return {
    name: 'Graphene Nanoribbon (LAMMPS AIREBO)',
    filename: 'graphene_ribbon.data',
    atoms,
    residues: [{ seq: 1, name: 'GRPH', chain: 'A', atoms }],
    chains: ['A'],
    box: { x: 35, y: 20, z: 20, type: 'cubic' },
    totalCharge: 0,
    numAtoms: atoms.length,
    numResidues: 1,
    massApprox: 0.86,
  };
}

// Generate Copper FCC Crystal Lattice (LAMMPS EAM benchmark)
function generateCopperLattice(): MoleculeStructure {
  const atoms: MoleculeStructure['atoms'] = [];
  const a = 3.615; // Copper FCC lattice constant in Angstroms
  let id = 1;

  for (let ix = 0; ix < 4; ix++) {
    for (let iy = 0; iy < 4; iy++) {
      for (let iz = 0; iz < 4; iz++) {
        // FCC unit cell basis: (0,0,0), (0.5,0.5,0), (0.5,0,0.5), (0,0.5,0.5)
        const bases = [
          [0, 0, 0],
          [0.5, 0.5, 0],
          [0.5, 0, 0.5],
          [0, 0.5, 0.5],
        ];

        for (const b of bases) {
          const x = (ix + b[0]) * a;
          const y = (iy + b[1]) * a;
          const z = (iz + b[2]) * a;

          atoms.push({
            id: id++,
            name: `Cu${id}`,
            resName: 'METL',
            resSeq: 1,
            chainID: 'A',
            x: Math.round(x * 100) / 100,
            y: Math.round(y * 100) / 100,
            z: Math.round(z * 100) / 100,
            element: 'CU',
            charge: 0,
            isBackbone: false,
          });
        }
      }
    }
  }

  return {
    name: 'Copper FCC Crystal (LAMMPS EAM)',
    filename: 'copper_fcc.data',
    atoms,
    residues: [{ seq: 1, name: 'METL', chain: 'A', atoms }],
    chains: ['A'],
    box: { x: 18, y: 18, z: 18, type: 'cubic' },
    totalCharge: 0,
    numAtoms: atoms.length,
    numResidues: 1,
    massApprox: 16.2,
  };
}

// Sample GROMACS Analysis Datasets
export function generateSampleXvgData(): {
  potentialEnergy: XvgSeries;
  temperature: XvgSeries;
  pressure: XvgSeries;
  rmsd: XvgSeries;
  rmsf: XvgSeries;
  gyration: XvgSeries;
} {
  // 1. Potential Energy Minimization (kJ/mol vs step)
  const peData: { x: number; y: number }[] = [];
  let currentE = -120400;
  for (let step = 0; step <= 1500; step += 25) {
    currentE += (-450000 - currentE) * 0.08 + (Math.random() - 0.5) * 500;
    peData.push({ x: step, y: Math.round(currentE) });
  }

  // 2. Temperature equilibration (K vs time ps)
  const tempPoints: { x: number; y: number }[] = [];
  for (let t = 0; t <= 100; t += 1) {
    const baseline = 300 - 150 * Math.exp(-t / 8);
    const noise = (Math.random() - 0.5) * 6;
    tempPoints.push({ x: t, y: Math.round((baseline + noise) * 10) / 10 });
  }

  // 3. Pressure equilibration (bar vs time ps)
  const pressPoints: { x: number; y: number }[] = [];
  for (let t = 0; t <= 100; t += 1) {
    // Pressure in liquid water MD naturally fluctuates between -300 and +300 bar
    const noise = (Math.random() - 0.5) * 120 + Math.sin(t / 4) * 30;
    pressPoints.push({ x: t, y: Math.round((1.0 + noise) * 10) / 10 });
  }

  // 4. RMSD (nm vs time ns)
  const rmsdPoints: { x: number; y: number }[] = [];
  for (let t = 0; t <= 10; t += 0.05) {
    const plateau = 0.16 * (1 - Math.exp(-t / 1.5));
    const fluctuation = (Math.random() - 0.5) * 0.015 + Math.sin(t * 1.5) * 0.01;
    rmsdPoints.push({ x: Math.round(t * 100) / 100, y: Math.round((0.04 + plateau + fluctuation) * 1000) / 1000 });
  }

  // 5. RMSF (nm vs residue index)
  const rmsfPoints: { x: number; y: number }[] = [];
  for (let res = 1; res <= 65; res++) {
    // Termini have high mobility, core secondary structures have low mobility
    let mobility = 0.08;
    if (res < 5 || res > 60) mobility += 0.18;
    else if ((res > 15 && res < 25) || (res > 40 && res < 50)) mobility += 0.09; // flexible loop
    else mobility += (Math.random() - 0.5) * 0.03;
    rmsfPoints.push({ x: res, y: Math.round(Math.max(0.04, mobility) * 1000) / 1000 });
  }

  // 6. Radius of Gyration (nm vs time ns)
  const gyrationPoints: { x: number; y: number }[] = [];
  for (let t = 0; t <= 10; t += 0.1) {
    const val = 1.42 + (Math.random() - 0.5) * 0.02 + Math.cos(t * 0.8) * 0.015;
    gyrationPoints.push({ x: Math.round(t * 10) / 10, y: Math.round(val * 1000) / 1000 });
  }

  return {
    potentialEnergy: {
      id: 'pe',
      title: 'Potential Energy during Minimization',
      xLabel: 'Energy Minimization Step',
      yLabel: 'Potential Energy',
      unitX: 'steps',
      unitY: 'kJ/mol',
      data: peData,
      stats: { min: -452000, max: -120400, mean: -425000, stdDev: 48000 },
    },
    temperature: {
      id: 'temp',
      title: 'System Temperature during NVT',
      xLabel: 'Time',
      yLabel: 'Temperature',
      unitX: 'ps',
      unitY: 'K',
      data: tempPoints,
      stats: { min: 148.2, max: 304.5, mean: 299.8, stdDev: 2.9 },
    },
    pressure: {
      id: 'press',
      title: 'System Pressure during NPT',
      xLabel: 'Time',
      yLabel: 'Pressure',
      unitX: 'ps',
      unitY: 'bar',
      data: pressPoints,
      stats: { min: -145.2, max: 152.8, mean: 1.04, stdDev: 54.2 },
    },
    rmsd: {
      id: 'rmsd',
      title: 'Backbone RMSD vs. Reference Crystal',
      xLabel: 'Simulation Time',
      yLabel: 'RMSD',
      unitX: 'ns',
      unitY: 'nm',
      data: rmsdPoints,
      stats: { min: 0.038, max: 0.215, mean: 0.174, stdDev: 0.021 },
    },
    rmsf: {
      id: 'rmsf',
      title: 'Root Mean Square Fluctuation (RMSF)',
      xLabel: 'Residue Index',
      yLabel: 'Atomic Fluctuation',
      unitX: 'res',
      unitY: 'nm',
      data: rmsfPoints,
      stats: { min: 0.045, max: 0.284, mean: 0.108, stdDev: 0.042 },
    },
    gyration: {
      id: 'gyr',
      title: 'Radius of Gyration (Rg) over Time',
      xLabel: 'Simulation Time',
      yLabel: 'Rg',
      unitX: 'ns',
      unitY: 'nm',
      data: gyrationPoints,
      stats: { min: 1.401, max: 1.442, mean: 1.421, stdDev: 0.008 },
    },
  };
}
