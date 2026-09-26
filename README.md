# GROMACS vs. LAMMPS Comparative Studio

<p align="center">
  <a href="https://github.com/shataragh/GROMACS-vs.-LAMMPS-Comparative-Studio">
    <img src="https://i.ibb.co/JWzpp1q3/github-project-banner-1790357373350.jpg" alt="GROMACS vs LAMMPS Comparative Studio Banner" width="100%">
  </a>
</p>

<p align="center">
  <strong>An interactive platform for comparing, visualizing, analyzing, and cross-translating Molecular Dynamics (MD) workflows.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://github.com/shataragh/GROMACS-vs.-LAMMPS-Comparative-Studio/stargazers"><img src="https://img.shields.io/github/stars/shataragh/GROMACS-vs.-LAMMPS-Comparative-Studio?style=flat&color=yellow" alt="GitHub Stars"></a>
  <a href="https://github.com/shataragh/GROMACS-vs.-LAMMPS-Comparative-Studio/issues"><img src="https://img.shields.io/github/issues/shataragh/GROMACS-vs.-LAMMPS-Comparative-Studio?color=red" alt="GitHub Issues"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node Version"></a>
</p>

---

## 📌 Table of Contents
- [Overview](#-overview)
- [Key Features](#-key-features)
- [Engine Comparison](#-engine-comparison)
- [Workflow Architecture](#-workflow-architecture)
- [Application Preview](#-application-preview)
- [Supported File Formats](#-supported-file-formats)
- [Getting Started](#-getting-started)
- [Project Directory Structure](#-project-directory-structure)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [Support & Donations](#-support--donations)
- [License](#-license)

---

## 📖 Overview

**GROMACS vs. LAMMPS Comparative Studio** bridges the divide between biomolecular modeling and materials science simulations. By offering side-by-side engine comparisons, real-time 3D structure visualization, protocol translation, and integrated analysis metrics, this platform enables researchers, educators, and computational chemists to seamlessly transition between **GROMACS** and **LAMMPS** ecosystems.

---

## ✨ Key Features

| Module | Capability & Description |
| :--- | :--- |
| **🔄 Engine Comparison** | Interactive side-by-side comparison of simulation parameters, boundary conditions, and execution syntax. |
| **⚙️ Protocol Translator** | Smart conversion suite mapping inputs, force field flags, and units between `GROMACS ↔ LAMMPS`. |
| **🧬 3D Visualization** | High-performance WebGL viewer supporting Ribbon, Ball-and-Stick, Space-Filling, and PBC box rendering. |
| **📊 Scientific Dashboard** | Dynamic plotting tools for trajectory evaluation (RMSD, RMSF, Radius of Gyration, Energy, Temperature/Pressure profiles). |
| **📂 Unified File Import** | Instant drag-and-drop parser for native GROMACS topologies/trajectories and LAMMPS data/dump files. |

---

## 🆚 Engine Comparison

| Feature / Domain | GROMACS | LAMMPS |
| :--- | :---: | :---: |
| **Primary Domain Focus** | Biomolecular Systems | Materials Science & Soft Matter |
| **Proteins & Nucleic Acids** | 🟢 Native / High | 🟡 Moderate / Script-based |
| **Membranes & Lipids** | 🟢 Native / High | 🟡 Moderate / Script-based |
| **Metals, Alloys & Crystals** | 🔴 Limited | 🟢 Native / High |
| **Polymers & Graphene** | 🟡 Moderate | 🟢 Native / High |
| **Reactive Force Fields (ReaxFF)** | 🔴 Not Supported | 🟢 Native / High |
| **Syntax Complexity** | Declarative (`.mdp` files) | Scripting / Command-driven |
| **System Modification Flexibility** | Moderate | Extremely High |

---

## 🔬 Workflow Architecture

### GROMACS Pipeline
```text
[PDB Structure] ➔ [pdb2gmx] ➔ [editconf] ➔ [solvate] ➔ [grompp] ➔ [mdrun] ➔ [Analysis]
```

### LAMMPS Pipeline
```text
[Structure / Data File] ➔ [Input Script Setup] ➔ [Force Field Assignment] ➔ [Fixes & Execution] ➔ [run] ➔ [Analysis]
```

---

## 🖼 Application Preview

<p align="center">
  <a href="https://ibb.co/C5kTMYVH">
    <img src="https://i.ibb.co/hRPtZ42m/asas.png" alt="Application Screenshot" width="85%">
  </a>
</p>

---

## 📂 Supported File Formats

The suite natively parses and visualizes the following file extensions:

- **GROMACS Formats:** `.gro`, `.top`, `.itp`, `.mdp`, `.xvg`, `.pdb`
- **LAMMPS Formats:** `.data`, `.dump`, `.in`, `.log.lammps`
- **Compressed Archives:** `.zip` (containing batch simulation packages)

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18.0 or higher) and `npm` installed.

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/shataragh/GROMACS-vs.-LAMMPS-Comparative-Studio.git](https://github.com/shataragh/GROMACS-vs.-LAMMPS-Comparative-Studio.git)
   cd GROMACS-vs.-LAMMPS-Comparative-Studio
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Launch the development environment:**
   ```bash
   npm run dev
   ```

4. **Build for production deployment:**
   ```bash
   npm run build
   ```

---

## 📁 Project Directory Structure

```text
GROMACS-vs.-LAMMPS-Comparative-Studio/
├── public/                 # Static public assets
├── assets/                 # Repository documentation assets (banners, screenshots)
├── src/
│   ├── components/         # Shared UI components
│   ├── viewer/             # 3D Molecule rendering engines (WebGL / Three.js / NGL)
│   ├── translator/         # Logic for GROMACS <-> LAMMPS translation
│   ├── comparison/         # Engine comparison parameters & matrices
│   ├── analysis/           # Charting & numerical data analysis scripts
│   ├── utilities/          # Parsers and formatting utilities
│   └── assets/             # Application design & icon assets
├── examples/               # Sample input topologies & data files
├── docs/                   # Additional documentation
├── package.json
├── vite.config.js
└── README.md
```

---

## 🛣 Roadmap

- [x] **Comparative Workflow Engine** — Interactive feature-by-feature comparisons.
- [x] **3D Molecular Renderer** — High-speed structural visualization.
- [x] **Protocol Translation Studio** — Automated directive mapping between engines.
- [x] **Scientific Data Plotting** — Integrated dashboard for `.xvg` and `.log` charts.
- [ ] **Interactive Trajectory Playback** — Support for multi-frame trajectory files.
- [ ] **AI-Assisted Parameter Advisor** — Machine Learning-backed recommendations for force-field mappings.
- [ ] **Benchmark Suite** — Performance analysis across hardware architectures (CPU vs. GPU).

---

## 🤝 Contributing

Contributions are welcome from the computational chemistry, materials science, and software engineering communities!

1. **Fork** the project.
2. Create your Feature Branch:
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. **Commit** your changes:
   ```bash
   git commit -m "Add some AmazingFeature"
   ```
4. **Push** to the branch:
   ```bash
   git push origin feature/AmazingFeature
   ```
5. Open a **Pull Request**.

---

## 💖 Support & Donations

If this tool has accelerated your research, simplified your teaching, or streamlined your workflows, consider supporting the ongoing development!

### Trust Wallet / Crypto Transfer

You can send TRX or TRC-20 tokens directly via **Trust Wallet**:

```text
TPoSnHr516phFiSrFWi2CrZvmQ5GpZTTvM
```

> **Wallet Platform:** Trust Wallet  
> **Network:** TRON (TRC-20)  
> **Supported Assets:** TRX, USDT (TRC-20), USDC (TRC-20)

*Your contributions help maintain cloud deployment, fund feature development, and support open-source computational science.*

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

<p align="center">
  <strong>Bridging Biomolecular and Materials Simulation Workflows</strong>
</p>
