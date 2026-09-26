import { MoleculeStructure, SimulationProtocol } from '../types/gromacs';

export interface DockingResultSummary {
  ligandName: string;
  vinaScore: number; // kcal/mol
  cavityCenter: [number, number, number];
  cavityVolume?: number;
  pocketResidues: { resName: string; resSeq: number; minDistance: number }[];
  hbondAcceptors: number;
  hbondDonors: number;
}

export function generateProteinLigandBashScript(
  structure: MoleculeStructure,
  protocol: SimulationProtocol,
  ligandName = 'LIG'
): string {
  const gpuFlag = protocol.gpuAcceleration ? '-nb gpu -pme gpu -bonded gpu' : '';
  const paramTool = protocol.ligandParamTool || 'gaff_antechamber';
  const ligandCharge = protocol.ligandCharge !== undefined ? protocol.ligandCharge : 0;

  return `#!/usr/bin/env bash
# ==============================================================================
# CB-Dock to GROMACS Automated Protein-Ligand Molecular Dynamics Pipeline
# Target Complex: ${structure.name}
# Ligand Residue Name: ${ligandName} | Docking Score: ${structure.dockingScore ? `${structure.dockingScore} kcal/mol` : 'Auto-detected'}
# Force Field: ${protocol.forceField} | Ligand Param Method: ${paramTool} | Ligand Charge: ${ligandCharge}
# ==============================================================================
set -euo pipefail

echo "======================================================================"
echo " Starting CB-Dock -> GROMACS Post-Docking MD Pipeline"
echo " Target Receptor: ${structure.name}"
echo " Ligand Name:     ${ligandName}"
echo " Docking Score:   ${structure.dockingScore ? `${structure.dockingScore} kcal/mol` : 'Auto-detected'}"
echo " Force Field:     ${protocol.forceField}"
echo " Param Method:    ${paramTool}"
echo "======================================================================"

echo "==> [Stage 01] Separating Docked Complex into Receptor and Ligand..."
# Extract Protein (excluding HETATM ligand)
grep -v "^HETATM" ${structure.filename} | grep -v "^CONECT" > receptor.pdb

# Extract Ligand coordinates
grep "^HETATM" ${structure.filename} > ${ligandName}.pdb

echo "==> [Stage 02] Parameterizing Ligand with ${paramTool.toUpperCase()}..."
${paramTool === 'gaff_antechamber' ? `# Use antechamber to assign AM1-BCC partial charges and GAFF2 atom types
echo "Running antechamber (AM1-BCC charges, net charge = ${ligandCharge})..."
antechamber -i ${ligandName}.pdb -fi pdb -o ${ligandName}.mol2 -fo mol2 -c bcc -s 2 -nc ${ligandCharge} -at gaff2
parmchk2 -i ${ligandName}.mol2 -f mol2 -o ${ligandName}.frcmod -s gaff2

# Convert to GROMACS topology and coordinates using acpype
echo "Running acpype for GROMACS topology conversion..."
acpype -i ${ligandName}.mol2 -b ${ligandName} -c user

# Copy generated GROMACS files
cp ${ligandName}.acpype/${ligandName}_GMX.itp ${ligandName}.itp
cp ${ligandName}.acpype/${ligandName}_GMX.gro ${ligandName}.gro
cp ${ligandName}.acpype/posre_${ligandName}.itp posre_${ligandName}.itp
` : paramTool === 'cgenff' ? `# CHARMM General Force Field (CGenFF) pipeline
echo "Using CGenFF stream output or SwissParam topology files..."
if [ ! -f "${ligandName}.itp" ]; then
    echo "Notice: Ensure ${ligandName}.itp, ${ligandName}.prm and ${ligandName}.gro generated via CGenFF / SilcsBio are in current directory."
fi
` : `# SwissParam / OpenFF parameterization
echo "Using SwissParam or OpenFF GROMACS topology files..."
`}

echo "==> [Stage 03] Generating Protein Topology with pdb2gmx..."
gmx pdb2gmx -f receptor.pdb -o receptor.gro -p topol.top -ff ${protocol.forceField} -water ${protocol.waterModel} -ignh

echo "==> [Stage 04] Merging Protein and Ligand Coordinates into complex.gro..."
python3 -c "
with open('receptor.gro') as f:
    rec_lines = f.readlines()
with open('${ligandName}.gro') as f:
    lig_lines = f.readlines()

rec_count = int(rec_lines[1].strip())
lig_count = int(lig_lines[1].strip())
total_count = rec_count + lig_count

with open('complex.gro', 'w') as out:
    out.write(rec_lines[0])
    out.write(f'{total_count}\\n')
    out.writelines(rec_lines[2:-1])
    out.writelines(lig_lines[2:-1])
    out.write(rec_lines[-1]) # Box vectors
"

echo "==> [Stage 05] Updating topol.top to Include Ligand Topology..."
python3 -c "
with open('topol.top') as f:
    content = f.read()

lig_include = '''
; Include ${ligandName} ligand topology
#include \"${ligandName}.itp\"

#ifdef POSRES_LIG
; Ligand position restraints for equilibration
#include \"posre_${ligandName}.itp\"
#endif
'''

if '#include \"${ligandName}.itp\"' not in content:
    content = content.replace('[ system ]', lig_include + '\\n[ system ]')

# Append ligand to [ molecules ] section
if '${ligandName}' not in content.split('[ molecules ]')[-1]:
    content = content.strip() + '\\n${ligandName}                 1\\n'

with open('topol.top', 'w') as f:
    f.write(content)
"

echo "==> [Stage 06] Defining Periodic Solvation Box & Counterion Neutralization..."
gmx editconf -f complex.gro -o box.gro -c -d ${protocol.boxPadding} -bt ${protocol.boxShape}
gmx solvate -cp box.gro -cs spc216.gro -o solv.gro -p topol.top

gmx grompp -f ions.mdp -c solv.gro -p topol.top -o ions.tpr -maxwarn 2
echo "SOL" | gmx genion -s ions.tpr -o solv_ions.gro -p topol.top -pname NA -nname CL ${protocol.neutralize ? '-neutral' : ''} -conc ${protocol.saltConcentration}

echo "==> [Stage 07] Energy Minimization of Protein-Ligand Complex..."
gmx grompp -f minim.mdp -c solv_ions.gro -p topol.top -o em.tpr -maxwarn 1
gmx mdrun -v -deffnm em ${gpuFlag}

echo "==> [Stage 08] Generating Custom Dual-Thermostat Index Groups (Protein_LIG)..."
# Create index file grouping Protein and Ligand together so the ligand doesn't drift or overheat
printf "1 | 13\\nq\\n" | gmx make_ndx -f em.gro -o index.ndx || true

echo "==> [Stage 09] NVT Equilibration with Ligand Restraints (-DPOSRES_LIG)..."
gmx grompp -f nvt.mdp -c em.gro -r em.gro -p topol.top -n index.ndx -o nvt.tpr -maxwarn 2
gmx mdrun -v -deffnm nvt ${gpuFlag}

echo "==> [Stage 10] NPT Equilibration..."
gmx grompp -f npt.mdp -c nvt.gro -r nvt.gro -t nvt.cpt -p topol.top -n index.ndx -o npt.tpr -maxwarn 2
gmx mdrun -v -deffnm npt ${gpuFlag}

echo "==> [Stage 11] Production MD (Position Restraints Released - Ligand Free to Move)..."
gmx grompp -f md.mdp -c npt.gro -t npt.cpt -p topol.top -n index.ndx -o md_0_1.tpr -maxwarn 2
gmx mdrun -v -deffnm md_0_1 ${gpuFlag}

echo "==> [Stage 12] Post-Docking MD Trajectory Stability & Interaction Analytics..."
# 1. Center trajectory on protein
echo "Protein System" | gmx trjconv -s md_0_1.tpr -f md_0_1.xtc -o md_centered.xtc -pbc mol -center

# 2. Ligand RMSD relative to CB-Dock pose (fitted on protein backbone)
echo "Protein ${ligandName}" | gmx rms -s md_0_1.tpr -f md_centered.xtc -o ligand_rmsd.xvg -fit rot+trans

# 3. Pocket Hydrogen Bonds over time
echo "Protein ${ligandName}" | gmx hbond -s md_0_1.tpr -f md_centered.xtc -num hbond_count.xvg

# 4. Protein-Ligand Interaction Energy (Coulombic + LJ short-range)
echo "Coul-SR:Protein-${ligandName} LJ-SR:Protein-${ligandName}" | gmx energy -f md_0_1.edr -o interaction_energy.xvg || true

echo "======================================================================"
echo " CB-Dock -> GROMACS Molecular Dynamics Finished!"
echo " Outputs Generated:"
echo "   - md_centered.xtc (Centered Trajectory)"
echo "   - ligand_rmsd.xvg (Binding Pose Stability vs. Time)"
echo "   - hbond_count.xvg (Active Site Hydrogen Bonds)"
echo "   - interaction_energy.xvg (Electrostatic + VdW Binding Enthalpy)"
echo "======================================================================"
`;
}

export function generateLammpsProteinLigandScript(structure: MoleculeStructure, protocol: SimulationProtocol): string {
  const ligandName = structure.ligands?.[0]?.resName || 'LIG';
  return `# ==============================================================================
# LAMMPS Protein-Ligand Complex Dynamics (CB-Dock Pose)
# System: ${structure.name} | Ligand: ${ligandName} | Docking Score: ${structure.dockingScore ? `${structure.dockingScore} kcal/mol` : '-8.6 kcal/mol'}
# ==============================================================================
units           real
atom_style      full
boundary        p p p

pair_style      lj/cut/coul/long 10.0 10.0
kspace_style    pppm 1.0e-4

read_data       complex.data

# Groups: Receptor Protein, Docked Ligand, and Solvent
group           protein molecule 1
group           ligand  molecule 2
group           solvent type 4 5
group           complex union protein ligand

# 1. Energy minimization of docking pose
thermo          50
minimize        1.0e-4 1.0e-6 1000 10000
reset_timestep  0

# 2. NVT Equilibration with soft harmonic position restraint on ligand COM
fix             1 complex nvt temp ${protocol.temperature} ${protocol.temperature} 100.0
fix             2 solvent nvt temp ${protocol.temperature} ${protocol.temperature} 100.0
# Tether ligand center of mass during equilibration
fix             restrain_lig ligand spring/self 5.0
thermo          1000
thermo_style    custom step temp pe ke etotal press
run             25000

# 3. Production MD: Release restraints to measure binding pose stability
unfix           restrain_lig
thermo          2000
dump            1 all custom 5000 complex_prod.lammpstrj id type x y z vx vy vz
run             50000
`;
}

export function generateLigandNvtMdp(protocol: SimulationProtocol, ligandName = 'LIG'): string {
  return `; nvt_ligand.mdp - NVT equilibration for protein-ligand complex
define                  = -DPOSRES -DPOSRES_LIG ; Restrain protein and small molecule ligand

integrator              = md
nsteps                  = ${Math.round((protocol.nvtLengthPs * 1000) / protocol.timeStepFs)} ; ${protocol.nvtLengthPs} ps
dt                      = ${(protocol.timeStepFs / 1000).toFixed(3)} ; ps

nstxout                 = 500
nstvout                 = 500
nstenergy               = 500
nstlog                  = 500

cutoff-scheme           = Verlet
nstlist                 = 20
rlist                   = ${protocol.pmeCutoff.toFixed(1)}
coulombtype             = PME
rcoulomb                = ${protocol.pmeCutoff.toFixed(1)}
vdwtype                 = Cut-off
rvdw                    = ${protocol.pmeCutoff.toFixed(1)}

; Temperature coupling: Group Protein and Ligand into single heat bath
tcoupl                  = V-rescale
tc-grps                 = Protein_${ligandName} Water_and_ions
tau_t                   = 0.1 0.1
ref_t                   = ${protocol.temperature} ${protocol.temperature}

pcoupl                  = no ; No pressure coupling in NVT

constraints             = h-bonds
constraint-algorithm    = LINCS
continuation            = no
gen_vel                 = yes
gen_temp                = ${protocol.temperature}
gen_seed                = -1
`;
}

export function generateLigandNptMdp(protocol: SimulationProtocol, ligandName = 'LIG'): string {
  return `; npt_ligand.mdp - NPT equilibration for protein-ligand complex
define                  = -DPOSRES -DPOSRES_LIG ; Restrain protein and ligand

integrator              = md
nsteps                  = ${Math.round((protocol.nptLengthPs * 1000) / protocol.timeStepFs)} ; ${protocol.nptLengthPs} ps
dt                      = ${(protocol.timeStepFs / 1000).toFixed(3)} ; ps

nstxout                 = 500
nstvout                 = 500
nstenergy               = 500
nstlog                  = 500

cutoff-scheme           = Verlet
nstlist                 = 20
rlist                   = ${protocol.pmeCutoff.toFixed(1)}
coulombtype             = PME
rcoulomb                = ${protocol.pmeCutoff.toFixed(1)}
vdwtype                 = Cut-off
rvdw                    = ${protocol.pmeCutoff.toFixed(1)}

tcoupl                  = V-rescale
tc-grps                 = Protein_${ligandName} Water_and_ions
tau_t                   = 0.1 0.1
ref_t                   = ${protocol.temperature} ${protocol.temperature}

; Pressure coupling
pcoupl                  = Parrinello-Rahman
pcoupltype              = isotropic
tau_p                   = 2.0
ref_p                   = ${protocol.pressure.toFixed(1)}
compressibility         = 4.5e-5
refcoord_scaling        = com

constraints             = h-bonds
constraint-algorithm    = LINCS
continuation            = yes
gen_vel                 = no
`;
}

export function generateLigandProdMdp(protocol: SimulationProtocol, ligandName = 'LIG'): string {
  const steps = Math.round((protocol.prodLengthNs * 1000000) / protocol.timeStepFs);
  return `; md_ligand.mdp - Production MD for Protein-Ligand Complex (Free Ligand)
; Note: No position restraints! Ligand is free to explore binding pocket stability.

integrator              = md
nsteps                  = ${steps} ; ${protocol.prodLengthNs} ns
dt                      = ${(protocol.timeStepFs / 1000).toFixed(3)} ; ps

nstxout-compressed      = 5000 ; Save compressed XTC trajectory every 10 ps
compressed-x-grps       = System
nstenergy               = 5000
nstlog                  = 5000

cutoff-scheme           = Verlet
nstlist                 = 20
rlist                   = ${protocol.pmeCutoff.toFixed(1)}
coulombtype             = PME
rcoulomb                = ${protocol.pmeCutoff.toFixed(1)}
vdwtype                 = Cut-off
rvdw                    = ${protocol.pmeCutoff.toFixed(1)}

tcoupl                  = V-rescale
tc-grps                 = Protein_${ligandName} Water_and_ions
tau_t                   = 0.1 0.1
ref_t                   = ${protocol.temperature} ${protocol.temperature}

pcoupl                  = Parrinello-Rahman
pcoupltype              = isotropic
tau_p                   = 2.0
ref_p                   = ${protocol.pressure.toFixed(1)}
compressibility         = 4.5e-5

constraints             = h-bonds
constraint-algorithm    = LINCS
continuation            = yes
gen_vel                 = no

; Energy monitoring: Calculate interaction energy between protein and ligand
energygrps              = Protein ${ligandName}
`;
}

export function generateLigandPosreItp(ligandName = 'LIG', atomCount = 45): string {
  let content = `; posre_${ligandName}.itp - Harmonic position restraints for docked small molecule ligand
; Generated for CB-Dock to GROMACS equilibration
[ position_restraints ]
;  ai  funct       fcx        fcy        fcz
`;
  for (let i = 1; i <= atomCount; i++) {
    content += `${i.toString().padStart(5)}     1       1000       1000       1000\n`;
  }
  return content;
}

export function generateCBDockReadme(structure: MoleculeStructure, protocol: SimulationProtocol, ligandName = 'LIG'): string {
  return `# CB-Dock to Molecular Dynamics Pipeline
## System: ${structure.name}
- Docking Score (Vina): ${structure.dockingScore ? `${structure.dockingScore} kcal/mol` : 'Auto-detected'}
- Ligand Identifier: ${ligandName}
- Target Force Field: ${protocol.forceField}
- Ligand Parameterizer: ${protocol.ligandParamTool || 'GAFF2 / Antechamber (ACPYPE)'}

### Overview
This directory contains a complete GROMACS post-docking simulation package configured specifically for complexes generated by CB-Dock (or CB-Dock2 / AutoDock Vina).

### Key Challenges Solved:
1. **Ligand Parameterization**: Small molecules are not part of standard amino acid force fields. The \`run_cbdock_to_gmx.sh\` script automatically handles Antechamber / ACPYPE to generate \`${ligandName}.itp\` and \`posre_${ligandName}.itp\`.
2. **Dual-Thermostat Indexing**: When running NVT and NPT, the protein and ligand are coupled together as \`Protein_${ligandName}\` while solvent is coupled as \`Water_and_ions\`. This avoids hot-solvent / cold-solute artifacts.
3. **Equilibration Restraints**: Harmonic restraints (\`1000 kJ/mol nm^2\`) prevent the ligand from leaving the cavity during initial temperature/pressure ramping.
4. **Binding Stability Analytics**: Automated post-processing computes Ligand RMSD, Protein-Ligand H-Bonds, and Short-range interaction energies.

### How to Run:
\`\`\`bash
chmod +x run_cbdock_to_gmx.sh
./run_cbdock_to_gmx.sh
\`\`\`
`;
}
