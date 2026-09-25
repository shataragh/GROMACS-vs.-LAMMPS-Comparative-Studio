# GROMACS vs. LAMMPS Comparative Studio

> A modern interactive platform for comparing, understanding, visualizing, and translating Molecular Dynamics workflows between GROMACS and LAMMPS.

<p align="center">
  <a href="https://ibb.co/350FF3vR">
    <img src="https://i.ibb.co/JWzpp1q3/github-project-banner-1790357373350.jpg" alt="GROMACS vs LAMMPS Comparative Studio">
  </a>
</p>

<p align="center">
  <strong>Compare • Visualize • Translate • Learn</strong>
</p>

---

## 📖 Overview

**GROMACS vs. LAMMPS Comparative Studio** is an interactive web-based environment designed to help researchers, students, and computational scientists explore the similarities, differences, strengths, and workflows of the two most widely used Molecular Dynamics (MD) simulation packages:

- **GROMACS** for biomolecular simulations
- **LAMMPS** for materials science and atomistic modeling

Through side-by-side comparisons, 3D visualization, workflow translation, and integrated analysis tools, users can quickly understand how simulation protocols differ across both ecosystems.

---

## ✨ Features

### 🔄 Side-by-Side Engine Comparison

- Compare GROMACS and LAMMPS simulation workflows
- Understand equivalent commands and settings
- Explore engine-specific capabilities
- Study best practices for each simulation package

### 📂 Drag-and-Drop File Import

Supported formats:

```text
.pdb
.gro
.top
.itp
.mdp
.xvg
.data
.dump
.in
.log.lammps
.zip
```

### 🧬 Interactive Molecular Visualization

- Ribbon structures
- Ball-and-stick models
- Space-filling representations
- Periodic simulation boxes
- Atomic distance measurements
- Structural inspection tools

### ⚙️ Protocol Translation Studio

Convert simulation concepts between:

```text
GROMACS → LAMMPS

LAMMPS → GROMACS
```

Features:

- Parameter mapping
- Unit conversion
- Command explanation
- Workflow recommendations

### 📊 Analysis Dashboard

Visualize simulation data with:

- RMSD
- RMSF
- Radius of Gyration (Rg)
- Temperature profiles
- Pressure profiles
- Energy curves
- Structural statistics

### 🎓 Educational Environment

Ideal for:

- Computational Biology
- Molecular Modeling
- Biophysics
- Computational Chemistry
- Materials Science
- Nanotechnology
- Graduate Education

---

## 🆚 GROMACS vs. LAMMPS

| Feature | GROMACS | LAMMPS |
|----------|----------|----------|
| Primary Focus | Biomolecular Systems | Materials & Atomistic Systems |
| Proteins | ✅ Excellent | ⚠️ Possible |
| DNA / RNA | ✅ Excellent | ⚠️ Possible |
| Membranes | ✅ Excellent | ⚠️ Possible |
| Metals | ⚠️ Limited | ✅ Excellent |
| Alloys | ⚠️ Limited | ✅ Excellent |
| Polymers | ⚠️ Moderate | ✅ Excellent |
| Graphene | ⚠️ Moderate | ✅ Excellent |
| Reactive Force Fields | ❌ Limited | ✅ Excellent |
| Ease of Use | ✅ High | ⚠️ Moderate |
| Flexibility | ⚠️ Moderate | ✅ Very High |

---

## 🔬 Typical Workflow Comparison

### GROMACS Workflow

```text
PDB Structure
      │
      ▼
   pdb2gmx
      │
      ▼
   editconf
      │
      ▼
    solvate
      │
      ▼
    grompp
      │
      ▼
    mdrun
      │
      ▼
   Analysis
```

### LAMMPS Workflow

```text
Structure/Data File
         │
         ▼
    Input Script
         │
         ▼
  Force Field Setup
         │
         ▼
 Simulation Commands
         │
         ▼
       run
         │
         ▼
      Analysis
```

---

## 🖼 Application Preview

<p align="center">
  <a href="https://ibb.co/C5kTMYVH">
    <img src="https://i.ibb.co/C5kTMYVH/asas.png" alt="Application Screenshot">
  </a>
</p>

---

## 🎯 Use Cases

### Computational Biology

- Protein simulations
- Enzyme systems
- Antibody modeling
- Membrane simulations
- Nucleic acid studies

### Materials Science

- Metal alloys
- Crystalline materials
- Graphene structures
- Nanotubes
- Polymers

### Education

- Teaching molecular dynamics
- Comparing simulation engines
- Understanding workflow differences
- Learning MD best practices

---

## 🚀 Installation

Clone the repository:

```bash
git clone https://github.com/shataragh/GROMACS-vs.-LAMMPS-Comparative-Studio.git
```

Enter the project directory:

```bash
cd GROMACS-vs.-LAMMPS-Comparative-Studio
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build production assets:

```bash
npm run build
```

---

## 📁 Project Structure

```text
GROMACS-vs.-LAMMPS-Comparative-Studio/
│
├── public/
├── src/
│   ├── components/
│   ├── viewer/
│   ├── translator/
│   ├── comparison/
│   ├── analysis/
│   ├── utilities/
│   └── assets/
│
├── examples/
├── docs/
├── package.json
├── vite.config.js
└── README.md
```

---

## 🛣 Roadmap

- [x] Comparative workflow browser
- [x] Molecular visualization
- [x] Protocol translation tools
- [x] Scientific plotting
- [ ] Interactive trajectory playback
- [ ] Advanced benchmark comparisons
- [ ] AI-assisted protocol recommendations
- [ ] Force-field comparison database
- [ ] Interactive tutorials
- [ ] Educational learning modules

---

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/my-feature
```

3. Commit your changes

```bash
git commit -m "Add new feature"
```

4. Push your branch

```bash
git push origin feature/my-feature
```

5. Open a Pull Request

---

## 📄 License

Released under the MIT License.

See the `LICENSE` file for details.

---

## ⭐ Support

If you find this project useful:

- Star the repository
- Share it with colleagues
- Report bugs
- Suggest new features

---

<p align="center">
  <strong>Bridging Biomolecular and Materials Simulation Workflows</strong>
</p>

<p align="center">
  GROMACS • LAMMPS • Molecular Dynamics • Computational Science
</p>
