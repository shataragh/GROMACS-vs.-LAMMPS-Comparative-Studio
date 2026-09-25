import { SimulationProtocol } from '../types/gromacs';

export function generateIonsMdp(): string {
  return `; ions.mdp - used as input into grompp to generate ions.tpr
; Parameters describing what to do, when to stop and what to save
integrator  = steep         ; Algorithm (steep = steepest descent minimization)
emtol       = 1000.0        ; Stop minimization when the maximum force < 1000.0 kJ/mol/nm
emstep      = 0.01          ; Minimization step size
nsteps      = 50000         ; Maximum number of (minimization) steps to perform

; Parameters describing how to find the neighbors of each atom and how to calculate the interactions
nstlist         = 1         ; Frequency to update the neighbor list and long range forces
cutoff-scheme   = Verlet    ; Buffered neighbor searching
ns_type         = grid      ; Method to determine neighbor list (simple, grid)
coulombtype     = cutoff    ; Treatment of long range electrostatic interactions
rcoulomb        = 1.0       ; Short-range electrostatic cutoff
rvdw            = 1.0       ; Short-range Van der Waals cutoff
pbc             = xyz       ; Periodic Boundary Conditions in all 3 dimensions
`;
}

export function generateMinimMdp(protocol: SimulationProtocol): string {
  return `; minim.mdp - Energy Minimization
; Parameters describing what to do, when to stop and what to save
integrator  = steep         ; Algorithm (steep = steepest descent minimization)
emtol       = 1000.0        ; Stop minimization when the maximum force < 1000.0 kJ/mol/nm
emstep      = 0.01          ; Minimization step size
nsteps      = ${protocol.minimSteps}         ; Maximum number of (minimization) steps to perform

; Parameters describing how to find the neighbors of each atom and how to calculate the interactions
nstlist         = 10        ; Frequency to update the neighbor list and long range forces
cutoff-scheme   = Verlet    ; Buffered neighbor searching
ns_type         = grid      ; Method to determine neighbor list (simple, grid)
coulombtype     = PME       ; Treatment of long range electrostatic interactions
rcoulomb        = ${protocol.pmeCutoff.toFixed(1)}       ; Short-range electrostatic cutoff
rvdw            = ${protocol.pmeCutoff.toFixed(1)}       ; Short-range Van der Waals cutoff
pbc             = xyz       ; Periodic Boundary Conditions in all 3 dimensions
`;
}

export function generateNvtMdp(protocol: SimulationProtocol): string {
  const steps = Math.round((protocol.nvtLengthPs * 1000) / protocol.timeStepFs);
  const dtPs = protocol.timeStepFs / 1000;

  return `; nvt.mdp - NVT Equilibration (Canonical Ensemble)
title                   = ${protocol.systemName} NVT equilibration
define                  = -DPOSRES  ; position restrain the protein

; Run parameters
integrator              = md        ; leap-frog integrator
nsteps                  = ${steps}     ; ${protocol.nvtLengthPs} ps = ${steps} steps
dt                      = ${dtPs.toFixed(3)}   ; ${protocol.timeStepFs} fs

; Output control
nstxout                 = 500       ; save coordinates every 1.0 ps
nstvout                 = 500       ; save velocities every 1.0 ps
nstenergy               = 500       ; save energies every 1.0 ps
nstlog                  = 500       ; update log file every 1.0 ps

; Bond parameters
continuation            = no        ; first dynamics run
constraint_algorithm    = lincs     ; holonomic constraints 
constraints             = h-bonds   ; bonds involving H are constrained
lincs_iter              = 1         ; accuracy of LINCS
lincs_order             = 4         ; also related to accuracy

; Nonbonded settings 
cutoff-scheme           = Verlet    ; Buffered neighbor searching
ns_type                 = grid      ; search neighboring grid cells
nstlist                 = 10        ; 20 fs, largely irrelevant with Verlet
rcoulomb                = ${protocol.pmeCutoff.toFixed(1)}       ; short-range electrostatic cutoff (nm)
rvdw                    = ${protocol.pmeCutoff.toFixed(1)}       ; short-range van der Waals cutoff (nm)
DispCorr                = EnerPres  ; account for cut-off vdW scheme

; Electrostatics
coulombtype             = PME       ; Particle Mesh Ewald for long-range electrostatics
pme_order               = 4         ; cubic interpolation
fourierspacing          = 0.16      ; grid spacing for FFT

; Temperature coupling is on
tcoupl                  = V-rescale ; modified Berendsen thermostat
tc-grps                 = Protein Non-Protein   ; two coupling groups - more accurate
tau_t                   = 0.1     0.1           ; time constant, in ps
ref_t                   = ${protocol.temperature}   ${protocol.temperature}           ; reference temperature, one for each group, in K

; Pressure coupling is off in NVT
pcoupl                  = no        ; no pressure coupling in NVT

; Periodic boundary conditions
pbc                     = xyz       ; 3-D PBC

; Velocity generation
gen_vel                 = yes       ; assign velocities from Maxwell distribution
gen_temp                = ${protocol.temperature}       ; temperature for Maxwell distribution
gen_seed                = -1        ; generate a random seed
`;
}

export function generateNptMdp(protocol: SimulationProtocol): string {
  const steps = Math.round((protocol.nptLengthPs * 1000) / protocol.timeStepFs);
  const dtPs = protocol.timeStepFs / 1000;

  return `; npt.mdp - NPT Equilibration (Isothermal-Isobaric Ensemble)
title                   = ${protocol.systemName} NPT equilibration
define                  = -DPOSRES  ; position restrain the protein

; Run parameters
integrator              = md        ; leap-frog integrator
nsteps                  = ${steps}     ; ${protocol.nptLengthPs} ps = ${steps} steps
dt                      = ${dtPs.toFixed(3)}   ; ${protocol.timeStepFs} fs

; Output control
nstxout                 = 500       ; save coordinates every 1.0 ps
nstvout                 = 500       ; save velocities every 1.0 ps
nstenergy               = 500       ; save energies every 1.0 ps
nstlog                  = 500       ; update log file every 1.0 ps

; Bond parameters
continuation            = yes       ; Restarting after NVT 
constraint_algorithm    = lincs     ; holonomic constraints 
constraints             = h-bonds   ; bonds involving H are constrained
lincs_iter              = 1         ; accuracy of LINCS
lincs_order             = 4         ; also related to accuracy

; Nonbonded settings 
cutoff-scheme           = Verlet    ; Buffered neighbor searching
ns_type                 = grid      ; search neighboring grid cells
nstlist                 = 10        ; 20 fs, largely irrelevant with Verlet
rcoulomb                = ${protocol.pmeCutoff.toFixed(1)}       ; short-range electrostatic cutoff (nm)
rvdw                    = ${protocol.pmeCutoff.toFixed(1)}       ; short-range van der Waals cutoff (nm)
DispCorr                = EnerPres  ; account for cut-off vdW scheme

; Electrostatics
coulombtype             = PME       ; Particle Mesh Ewald for long-range electrostatics
pme_order               = 4         ; cubic interpolation
fourierspacing          = 0.16      ; grid spacing for FFT

; Temperature coupling is on
tcoupl                  = V-rescale ; modified Berendsen thermostat
tc-grps                 = Protein Non-Protein   ; two coupling groups
tau_t                   = 0.1     0.1           ; time constant, in ps
ref_t                   = ${protocol.temperature}   ${protocol.temperature}           ; reference temperature, in K

; Pressure coupling is on
pcoupl                  = Parrinello-Rahman     ; Pressure coupling on in NPT
pcoupltype              = isotropic             ; uniform scaling of box vectors
tau_p                   = 2.0                   ; time constant, in ps
ref_p                   = ${protocol.pressure.toFixed(1)}                   ; reference pressure, in bar
compressibility         = 4.5e-5                ; isothermal compressibility of water, bar^-1
refcoord_scaling        = com

; Periodic boundary conditions
pbc                     = xyz       ; 3-D PBC

; Velocity generation
gen_vel                 = no        ; Velocity generation is off (continue from NVT)
`;
}

export function generateProductionMdp(protocol: SimulationProtocol): string {
  const steps = Math.round((protocol.prodLengthNs * 1000 * 1000) / protocol.timeStepFs);
  const dtPs = protocol.timeStepFs / 1000;

  return `; md.mdp - Production MD Simulation (${protocol.prodLengthNs} ns)
title                   = ${protocol.systemName} Production MD

; Run parameters
integrator              = md        ; leap-frog integrator
nsteps                  = ${steps}  ; ${protocol.prodLengthNs} ns
dt                      = ${dtPs.toFixed(3)}   ; ${protocol.timeStepFs} fs

; Output control
nstxout-compressed      = 5000      ; save compressed coordinates every 10.0 ps
compressed-x-grps       = System    ; replaces nstxtcout
nstenergy               = 5000      ; save energies every 10.0 ps
nstlog                  = 5000      ; update log file every 10.0 ps

; Bond parameters
continuation            = yes       ; Restarting after NPT 
constraint_algorithm    = lincs     ; holonomic constraints 
constraints             = h-bonds   ; bonds involving H are constrained
lincs_iter              = 1         ; accuracy of LINCS
lincs_order             = 4         ; also related to accuracy

; Neighborsearching
cutoff-scheme           = Verlet    ; Buffered neighbor searching
ns_type                 = grid      ; search neighboring grid cells
nstlist                 = 10        ; 20 fs, largely irrelevant with Verlet
rcoulomb                = ${protocol.pmeCutoff.toFixed(1)}       ; short-range electrostatic cutoff (nm)
rvdw                    = ${protocol.pmeCutoff.toFixed(1)}       ; short-range van der Waals cutoff (nm)
DispCorr                = EnerPres  ; account for cut-off vdW scheme

; Electrostatics
coulombtype             = PME       ; Particle Mesh Ewald for long-range electrostatics
pme_order               = 4         ; cubic interpolation
fourierspacing          = 0.16      ; grid spacing for FFT

; Temperature coupling is on
tcoupl                  = V-rescale ; modified Berendsen thermostat
tc-grps                 = Protein Non-Protein   ; two coupling groups
tau_t                   = 0.1     0.1           ; time constant, in ps
ref_t                   = ${protocol.temperature}   ${protocol.temperature}           ; reference temperature, in K

; Pressure coupling is on
pcoupl                  = Parrinello-Rahman     ; Pressure coupling on in NPT
pcoupltype              = isotropic             ; uniform scaling of box vectors
tau_p                   = 2.0                   ; time constant, in ps
ref_p                   = ${protocol.pressure.toFixed(1)}                   ; reference pressure, in bar
compressibility         = 4.5e-5                ; isothermal compressibility of water, bar^-1

; Periodic boundary conditions
pbc                     = xyz       ; 3-D PBC

; Velocity generation
gen_vel                 = no        ; Continuing from NPT
`;
}

export function generateRunBashScript(protocol: SimulationProtocol, inputFile = 'input.pdb'): string {
  const gpuFlag = protocol.gpuAcceleration ? '-nb gpu -pme gpu -bonded gpu' : '';
  const isGro = inputFile.endsWith('.gro');

  return `#!/usr/bin/env bash
# ==============================================================================
# GROMACS Automated Molecular Dynamics Pipeline
# Target System: ${protocol.systemName}
# Force Field: ${protocol.forceField} | Water Model: ${protocol.waterModel}
# Temperature: ${protocol.temperature} K | Pressure: ${protocol.pressure} bar | Length: ${protocol.prodLengthNs} ns
# ==============================================================================
set -euo pipefail

echo "==> [Stage 01] Generating Topology and Coordinates..."
${isGro ? `# Input is already .gro coordinate file
cp ${inputFile} system_clean.gro
` : `gmx pdb2gmx -f ${inputFile} -o processed.gro -p topol.top -ff ${protocol.forceField} -water ${protocol.waterModel}
`}
echo "==> [Stage 02] Defining Periodic Simulation Box..."
gmx editconf -f ${isGro ? 'system_clean.gro' : 'processed.gro'} -o box.gro -c -d ${protocol.boxPadding} -bt ${protocol.boxShape}

echo "==> [Stage 03] Solvating System with Water..."
gmx solvate -cp box.gro -cs spc216.gro -o solv.gro -p topol.top

echo "==> [Stage 04] Neutralizing System and Adding Salt Ions..."
gmx grompp -f ions.mdp -c solv.gro -p topol.top -o ions.tpr -maxwarn 1
echo "SOL" | gmx genion -s ions.tpr -o solv_ions.gro -p topol.top -pname NA -nname CL ${protocol.neutralize ? '-neutral' : ''} -conc ${protocol.saltConcentration}

echo "==> [Stage 05] Energy Minimization..."
gmx grompp -f minim.mdp -c solv_ions.gro -p topol.top -o em.tpr
gmx mdrun -v -deffnm em ${gpuFlag}

# Extract Potential Energy
echo "Potential" | gmx energy -f em.edr -o potential.xvg

echo "==> [Stage 06] NVT Equilibration (Temperature coupling: ${protocol.temperature} K)..."
gmx grompp -f nvt.mdp -c em.gro -r em.gro -p topol.top -o nvt.tpr
gmx mdrun -v -deffnm nvt ${gpuFlag}

# Extract Temperature
echo "Temperature" | gmx energy -f nvt.edr -o temperature.xvg

echo "==> [Stage 07] NPT Equilibration (Pressure coupling: ${protocol.pressure} bar)..."
gmx grompp -f npt.mdp -c nvt.gro -r nvt.gro -t nvt.cpt -p topol.top -o npt.tpr
gmx mdrun -v -deffnm npt ${gpuFlag}

# Extract Pressure & Density
echo "Pressure Density" | gmx energy -f npt.edr -o pressure_density.xvg

echo "==> [Stage 08] Production Molecular Dynamics (${protocol.prodLengthNs} ns)..."
gmx grompp -f md.mdp -c npt.gro -t npt.cpt -p topol.top -o md_0_1.tpr
gmx mdrun -v -deffnm md_0_1 ${gpuFlag}

echo "==> [Stage 09] Post-Simulation Processing & Centering Trajectory..."
# Center protein in box and remove periodic boundary condition jumps
echo "Backbone System" | gmx trjconv -s md_0_1.tpr -f md_0_1.xtc -o md_centered.xtc -pbc mol -center

echo "==> [Stage 10] Structural Analytics..."
# RMSD relative to crystal structure
echo "Backbone Backbone" | gmx rms -s md_0_1.tpr -f md_centered.xtc -o rmsd.xvg -tu ns
# RMSF per residue
echo "Backbone" | gmx rmsf -s md_0_1.tpr -f md_centered.xtc -o rmsf.xvg -res
# Radius of Gyration
echo "Protein" | gmx gyrate -s md_0_1.tpr -f md_centered.xtc -o gyrate.xvg

echo "==> Pipeline Execution Finished Successfully!"
`;
}

export function generateSlurmScript(protocol: SimulationProtocol): string {
  return `#!/bin/bash
#SBATCH --job-name=gmx_${protocol.systemName.replace(/[^a-zA-Z0-9]/g, '_')}
#SBATCH --output=gmx_%j.log
#SBATCH --error=gmx_%j.err
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=8
#SBATCH --gres=gpu:1
#SBATCH --time=24:00:00
#SBATCH --partition=gpu

# Load GROMACS Environment Module (adjust module name for your cluster)
module purge
module load gromacs/2023.2-cuda

export OMP_NUM_THREADS=\${SLURM_CPUS_PER_TASK}

echo "Starting GROMACS Job ID: \${SLURM_JOB_ID} on \$(hostname)"
bash run_pipeline.sh
echo "Finished at \$(date)"
`;
}

export function generateDockerCommand(protocol: SimulationProtocol): string {
  return `# Run GROMACS inside official container with NVIDIA GPU passthrough:
docker run --rm -it --gpus all \\
  -v "\$(pwd):/simulation" \\
  -w /simulation \\
  gromacs/gromacs:latest \\
  bash run_pipeline.sh
`;
}
