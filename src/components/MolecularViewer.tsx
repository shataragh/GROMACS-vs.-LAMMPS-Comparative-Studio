import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Atom, MoleculeStructure } from '../types/gromacs';
import { MolstarViewer } from './MolstarViewer';
import { Camera, Eye, HelpCircle, Layers, Maximize2, Move, RotateCcw, Ruler, Sparkles, Zap, Database } from 'lucide-react';

interface MolecularViewerProps {
  structure: MoleculeStructure | null;
  height?: string;
  onSelectAtom?: (atom: Atom | null) => void;
  onOpenPdbModal?: () => void;
  defaultEngine?: 'molstar' | 'three';
}

type Representation = 'ribbon' | 'ball_stick' | 'spacefill' | 'wireframe';
type ColorScheme = 'element' | 'secondary' | 'chain' | 'bfactor';

const CPK_COLORS: Record<string, number> = {
  H: 0xffffff,
  C: 0x334155, // slate-700
  N: 0x3b82f6, // blue-500
  O: 0xef4444, // red-500
  S: 0xeab308, // yellow-500
  P: 0xf97316, // orange-500
  CL: 0x22c55e, // green-500
  NA: 0x8b5cf6, // purple-500
  MG: 0x14b8a6, // teal-500
  FE: 0xd97706,
  ZN: 0x64748b,
};

const VDW_RADII: Record<string, number> = {
  H: 1.2,
  C: 1.7,
  N: 1.55,
  O: 1.52,
  S: 1.8,
  P: 1.8,
  CL: 1.75,
  NA: 2.27,
  MG: 1.73,
};

export const MolecularViewer: React.FC<MolecularViewerProps> = ({
  structure,
  height = '520px',
  onSelectAtom,
  onOpenPdbModal,
  defaultEngine = 'molstar',
}) => {
  const [viewerEngine, setViewerEngine] = useState<'molstar' | 'three'>(defaultEngine);

  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const molGroupRef = useRef<THREE.Group | null>(null);
  const boxGroupRef = useRef<THREE.Group | null>(null);
  const measureGroupRef = useRef<THREE.Group | null>(null);

  const [representation, setRepresentation] = useState<Representation>('ribbon');
  const [colorScheme, setColorScheme] = useState<ColorScheme>('secondary');
  const [showBox, setShowBox] = useState<boolean>(true);
  const [showWater, setShowWater] = useState<boolean>(false);
  const [measureMode, setMeasureMode] = useState<boolean>(false);
  const [measuredDistance, setMeasuredDistance] = useState<number | null>(null);
  const [hoveredAtom, setHoveredAtom] = useState<Atom | null>(null);
  const [selectedAtoms, setSelectedAtoms] = useState<Atom[]>([]);

  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const prevMousePosRef = useRef({ x: 0, y: 0 });

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const heightPx = container.clientHeight || 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090e); // Deep obsidian lab dark
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / heightPx, 0.1, 2000);
    camera.position.set(0, 0, 70);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight1.position.set(50, 80, 100);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.5); // Cool rim light
    dirLight2.position.set(-60, -40, -50);
    scene.add(dirLight2);

    const molGroup = new THREE.Group();
    scene.add(molGroup);
    molGroupRef.current = molGroup;

    const boxGroup = new THREE.Group();
    scene.add(boxGroup);
    boxGroupRef.current = boxGroup;

    const measureGroup = new THREE.Group();
    scene.add(measureGroup);
    measureGroupRef.current = measureGroup;

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Build molecular mesh when structure or representation changes
  useEffect(() => {
    if (!structure || !molGroupRef.current || !sceneRef.current) return;
    const molGroup = molGroupRef.current;
    // Clear previous molecule meshes
    while (molGroup.children.length > 0) {
      const child = molGroup.children[0];
      molGroup.remove(child);
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
    }

    if (!structure.atoms || structure.atoms.length === 0) return;

    // Compute center of mass to center structure at origin (0,0,0)
    let cx = 0, cy = 0, cz = 0;
    for (const a of structure.atoms) {
      cx += a.x;
      cy += a.y;
      cz += a.z;
    }
    cx /= structure.atoms.length;
    cy /= structure.atoms.length;
    cz /= structure.atoms.length;

    // Filter water/ions if requested
    const visibleAtoms = structure.atoms.filter(a => {
      const isWater = ['SOL', 'HOH', 'WAT', 'TIP3'].includes(a.resName);
      const isIon = ['NA', 'CL', 'MG', 'K'].includes(a.resName);
      if (!showWater && (isWater || isIon)) return false;
      return true;
    });

    const getAtomColor = (atom: Atom): number => {
      if (colorScheme === 'element') {
        return CPK_COLORS[atom.element] || 0x94a3b8;
      }
      if (colorScheme === 'secondary') {
        const res = structure.residues.find(r => r.seq === atom.resSeq);
        if (res?.secondaryStructure === 'helix') return 0x06b6d4; // Cyan
        if (res?.secondaryStructure === 'sheet') return 0xf59e0b; // Amber
        return 0x64748b; // Coil slate
      }
      if (colorScheme === 'chain') {
        const colors = [0x38bdf8, 0xa855f7, 0x10b981, 0xf43f5e];
        const idx = structure.chains.indexOf(atom.chainID);
        return colors[Math.max(0, idx) % colors.length];
      }
      if (colorScheme === 'bfactor') {
        // Temperature factor ramp
        const val = Math.min(1, Math.max(0, (atom.tempFactor || 0) / 40));
        const color = new THREE.Color();
        color.setHSL(0.66 * (1 - val), 1.0, 0.5); // Blue (stable) to Red (flexible)
        return color.getHex();
      }
      return 0x38bdf8;
    };

    if (representation === 'ribbon') {
      // 1. Render smooth cartoon tube along C-alpha backbone
      const caAtoms = visibleAtoms.filter(a => a.name === 'CA');
      if (caAtoms.length > 2) {
        const points = caAtoms.map(a => new THREE.Vector3(a.x - cx, a.y - cy, a.z - cz));
        const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
        const tubeGeom = new THREE.TubeGeometry(curve, Math.max(20, caAtoms.length * 6), 0.55, 12, false);
        
        // Vertex colors based on secondary structure along spline
        const count = tubeGeom.attributes.position.count;
        const colors = new Float32Array(count * 3);
        const col = new THREE.Color();

        for (let i = 0; i < count; i++) {
          const u = i / count;
          const atomIdx = Math.min(caAtoms.length - 1, Math.floor(u * caAtoms.length));
          const atom = caAtoms[atomIdx];
          col.setHex(getAtomColor(atom));
          colors[i * 3] = col.r;
          colors[i * 3 + 1] = col.g;
          colors[i * 3 + 2] = col.b;
        }

        tubeGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const tubeMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.35,
          metalness: 0.2,
        });
        const tubeMesh = new THREE.Mesh(tubeGeom, tubeMat);
        molGroup.add(tubeMesh);
      }

      // Also render non-backbone sidechain ligand atoms if any as subtle sticks
      const heteroAtoms = visibleAtoms.filter(a => !a.isBackbone);
      if (heteroAtoms.length > 0 && heteroAtoms.length < 250) {
        const sphereGeom = new THREE.SphereGeometry(0.3, 8, 8);
        for (const a of heteroAtoms) {
          const mat = new THREE.MeshStandardMaterial({ color: getAtomColor(a), roughness: 0.4 });
          const m = new THREE.Mesh(sphereGeom, mat);
          m.position.set(a.x - cx, a.y - cy, a.z - cz);
          m.userData = { atom: a };
          molGroup.add(m);
        }
      }
    } else if (representation === 'ball_stick' || representation === 'spacefill') {
      const isSpacefill = representation === 'spacefill';
      const sphereGeom = new THREE.SphereGeometry(1, 16, 16);

      // Create atoms as meshes
      for (const a of visibleAtoms) {
        const baseRadius = VDW_RADII[a.element] || 1.6;
        const radius = isSpacefill ? baseRadius * 0.9 : 0.45;
        const mat = new THREE.MeshStandardMaterial({
          color: getAtomColor(a),
          roughness: 0.3,
          metalness: 0.15,
        });
        const mesh = new THREE.Mesh(sphereGeom, mat);
        mesh.scale.set(radius, radius, radius);
        mesh.position.set(a.x - cx, a.y - cy, a.z - cz);
        mesh.userData = { atom: a };
        molGroup.add(mesh);
      }

      // Connect covalent bonds for ball & stick
      if (!isSpacefill) {
        const bondMaterial = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 });
        const maxAtomsForBonds = Math.min(visibleAtoms.length, 600); // Performance safeguard
        for (let i = 0; i < maxAtomsForBonds; i++) {
          const a1 = visibleAtoms[i];
          for (let j = i + 1; j < maxAtomsForBonds; j++) {
            const a2 = visibleAtoms[j];
            const dx = a1.x - a2.x;
            const dy = a1.y - a2.y;
            const dz = a1.z - a2.z;
            const distSq = dx * dx + dy * dy + dz * dz;
            if (distSq > 0.6 && distSq < 3.8) {
              const dist = Math.sqrt(distSq);
              const bondGeom = new THREE.CylinderGeometry(0.12, 0.12, dist, 8);
              const bondMesh = new THREE.Mesh(bondGeom, bondMaterial);

              const p1 = new THREE.Vector3(a1.x - cx, a1.y - cy, a1.z - cz);
              const p2 = new THREE.Vector3(a2.x - cx, a2.y - cy, a2.z - cz);
              const mid = p1.clone().add(p2).multiplyScalar(0.5);
              bondMesh.position.copy(mid);

              const dir = p2.clone().sub(p1).normalize();
              const up = new THREE.Vector3(0, 1, 0);
              const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
              bondMesh.setRotationFromQuaternion(quat);

              molGroup.add(bondMesh);
            }
          }
        }
      }
    } else if (representation === 'wireframe') {
      const positions: number[] = [];
      const colors: number[] = [];
      const col = new THREE.Color();

      for (let i = 0; i < visibleAtoms.length; i++) {
        const a1 = visibleAtoms[i];
        for (let j = i + 1; j < Math.min(i + 20, visibleAtoms.length); j++) {
          const a2 = visibleAtoms[j];
          const distSq = Math.pow(a1.x - a2.x, 2) + Math.pow(a1.y - a2.y, 2) + Math.pow(a1.z - a2.z, 2);
          if (distSq < 3.8) {
            positions.push(a1.x - cx, a1.y - cy, a1.z - cz);
            positions.push(a2.x - cx, a2.y - cy, a2.z - cz);

            col.setHex(getAtomColor(a1));
            colors.push(col.r, col.g, col.b);
            col.setHex(getAtomColor(a2));
            colors.push(col.r, col.g, col.b);
          }
        }
      }

      const lineGeom = new THREE.BufferGeometry();
      lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      lineGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 1.5 });
      const lineMesh = new THREE.LineSegments(lineGeom, lineMat);
      molGroup.add(lineMesh);
    }

    // Auto-adjust camera distance
    if (cameraRef.current) {
      let maxDist = 25;
      for (const a of visibleAtoms) {
        const d = Math.sqrt(Math.pow(a.x - cx, 2) + Math.pow(a.y - cy, 2) + Math.pow(a.z - cz, 2));
        if (d > maxDist) maxDist = d;
      }
      cameraRef.current.position.set(0, 0, maxDist * 2.4);
      cameraRef.current.lookAt(0, 0, 0);
    }
  }, [structure, representation, colorScheme, showWater]);

  // Periodic Box Wireframe
  useEffect(() => {
    if (!boxGroupRef.current) return;
    const boxGroup = boxGroupRef.current;
    while (boxGroup.children.length > 0) {
      const child = boxGroup.children[0];
      boxGroup.remove(child);
    }

    if (!showBox || !structure?.box) return;

    const { x, y, z } = structure.box;
    const geom = new THREE.BoxGeometry(x, y, z);
    const edges = new THREE.EdgesGeometry(geom);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4, // Laser cyan
      transparent: true,
      opacity: 0.35,
      linewidth: 1,
    });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    boxGroup.add(wireframe);
  }, [showBox, structure?.box]);

  // Handle Mouse Interactions (Rotation, Pan, Zoom, Distance measurement)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      isDraggingRef.current = true;
    } else if (e.button === 2 || e.shiftKey) {
      isPanningRef.current = true;
    }
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const deltaX = e.clientX - prevMousePosRef.current.x;
    const deltaY = e.clientY - prevMousePosRef.current.y;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };

    if (isDraggingRef.current && molGroupRef.current && !e.shiftKey) {
      molGroupRef.current.rotation.y += deltaX * 0.007;
      molGroupRef.current.rotation.x += deltaY * 0.007;
      if (boxGroupRef.current) {
        boxGroupRef.current.rotation.copy(molGroupRef.current.rotation);
      }
      if (measureGroupRef.current) {
        measureGroupRef.current.rotation.copy(molGroupRef.current.rotation);
      }
    } else if (isPanningRef.current || (isDraggingRef.current && e.shiftKey)) {
      if (cameraRef.current) {
        cameraRef.current.position.x -= deltaX * 0.05;
        cameraRef.current.position.y += deltaY * 0.05;
      }
    }

    // Raycast for hover probe
    if (containerRef.current && cameraRef.current && molGroupRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(molGroupRef.current.children, true);
      const hit = intersects.find(i => i.object.userData?.atom);
      if (hit && hit.object.userData.atom) {
        setHoveredAtom(hit.object.userData.atom);
      } else {
        setHoveredAtom(null);
      }
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!cameraRef.current) return;
    const zoomFactor = e.deltaY * 0.05;
    cameraRef.current.position.z = Math.max(10, Math.min(500, cameraRef.current.position.z + zoomFactor));
  };

  // Atom selection / Distance measurement
  const handleClick = (e: React.MouseEvent) => {
    if (hoveredAtom) {
      if (onSelectAtom) onSelectAtom(hoveredAtom);

      if (measureMode) {
        const next = [...selectedAtoms, hoveredAtom].slice(-2);
        setSelectedAtoms(next);
        if (next.length === 2) {
          const dx = next[0].x - next[1].x;
          const dy = next[0].y - next[1].y;
          const dz = next[0].z - next[1].z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          setMeasuredDistance(Math.round(dist * 100) / 100);
        }
      }
    }
  };

  const resetCamera = () => {
    if (cameraRef.current && molGroupRef.current) {
      molGroupRef.current.rotation.set(0, 0, 0);
      if (boxGroupRef.current) boxGroupRef.current.rotation.set(0, 0, 0);
      if (measureGroupRef.current) measureGroupRef.current.rotation.set(0, 0, 0);
      cameraRef.current.position.set(0, 0, 70);
      cameraRef.current.lookAt(0, 0, 0);
    }
  };

  const captureSnapshot = () => {
    if (rendererRef.current) {
      const url = rendererRef.current.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `${structure?.name || 'structure'}_snapshot.png`;
      a.click();
    }
  };

  if (viewerEngine === 'molstar') {
    return (
      <MolstarViewer
        structure={structure}
        height={height}
        onOpenPdbModal={onOpenPdbModal}
        onTogglePhysicsViewer={() => setViewerEngine('three')}
        showEngineToggle={true}
      />
    );
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-slate-800 bg-[#07090E] select-none">
      {/* Top 3D Control Ribbon */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Representations & Color Scheme */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-lg pointer-events-auto">
          {(['ribbon', 'ball_stick', 'spacefill', 'wireframe'] as Representation[]).map((rep) => (
            <button
              key={rep}
              onClick={() => setRepresentation(rep)}
              className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                representation === rep
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {rep === 'ball_stick' ? 'Ball & Stick' : rep.charAt(0).toUpperCase() + rep.slice(1)}
            </button>
          ))}

          <span className="w-px h-3.5 bg-slate-700 mx-1" />

          <select
            value={colorScheme}
            onChange={(e) => setColorScheme(e.target.value as ColorScheme)}
            className="bg-transparent text-xs font-mono text-slate-300 border-none focus:outline-none cursor-pointer pr-1"
          >
            <option value="secondary" className="bg-slate-900 text-slate-200">Secondary Structure</option>
            <option value="element" className="bg-slate-900 text-slate-200">Element (CPK)</option>
            <option value="chain" className="bg-slate-900 text-slate-200">Chain</option>
            <option value="bfactor" className="bg-slate-900 text-slate-200">B-Factor</option>
          </select>
        </div>

        {/* Right: Tools & Actions */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-lg pointer-events-auto">
          {/* Switch back to Mol* */}
          <button
            onClick={() => setViewerEngine('molstar')}
            title="Switch back to Mol* 3D Viewer"
            className="px-2 py-1 text-xs font-mono rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition-colors flex items-center gap-1 font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mol* Engine</span>
          </button>

          {onOpenPdbModal && (
            <button
              onClick={onOpenPdbModal}
              title="Fetch structure directly from Protein Data Bank"
              className="p-1.5 text-cyan-400 hover:text-cyan-300 rounded transition-colors"
            >
              <Database className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setShowBox(!showBox)}
            title="Toggle Periodic Simulation Box"
            className={`p-1.5 rounded text-xs transition-colors ${
              showBox ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setMeasureMode(!measureMode);
              if (measureMode) {
                setSelectedAtoms([]);
                setMeasuredDistance(null);
              }
            }}
            title="Measure Atomic Distance (Click two atoms)"
            className={`p-1.5 rounded text-xs transition-colors ${
              measureMode ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ruler className="w-4 h-4" />
          </button>

          <button
            onClick={resetCamera}
            title="Reset Camera View"
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={captureSnapshot}
            title="Export High-Res Snapshot"
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas Viewport */}
      <div
        ref={containerRef}
        style={{ height }}
        className="w-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Bottom Telemetry HUD */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none text-xs font-mono">
        {/* Hover Probe */}
        {hoveredAtom ? (
          <div className="bg-slate-900/95 backdrop-blur border border-slate-700/80 px-3 py-1.5 rounded-lg text-slate-200 flex items-center gap-3 shadow-lg pointer-events-auto">
            <span className="text-cyan-400 font-semibold">{hoveredAtom.resName} {hoveredAtom.resSeq}</span>
            <span>Atom: <strong className="text-white">{hoveredAtom.name}</strong> ({hoveredAtom.element})</span>
            <span className="text-slate-400 tabular-nums">
              ({hoveredAtom.x.toFixed(1)}, {hoveredAtom.y.toFixed(1)}, {hoveredAtom.z.toFixed(1)}) Å
            </span>
            {hoveredAtom.tempFactor !== undefined && (
              <span className="text-slate-400">B: {hoveredAtom.tempFactor.toFixed(1)}</span>
            )}
          </div>
        ) : (
          <div className="text-slate-500 flex items-center gap-2">
            <span>Left-drag: Rotate</span>
            <span>·</span>
            <span>Right-drag: Pan</span>
            <span>·</span>
            <span>Scroll: Zoom</span>
          </div>
        )}

        {/* Measurement HUD */}
        {measuredDistance !== null && (
          <div className="bg-amber-950/80 border border-amber-600/50 px-3 py-1.5 rounded-lg text-amber-200 flex items-center gap-2 pointer-events-auto">
            <Ruler className="w-3.5 h-3.5 text-amber-400" />
            <span>Distance: <strong className="text-white tabular-nums">{measuredDistance} Å</strong> ({(measuredDistance / 10).toFixed(3)} nm)</span>
            <button
              onClick={() => {
                setSelectedAtoms([]);
                setMeasuredDistance(null);
              }}
              className="text-amber-400 hover:text-white ml-1 underline"
            >
              Clear
            </button>
          </div>
        )}

        {/* Box Dimensions */}
        {structure?.box && (
          <div className="text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800 tabular-nums">
            Box: {(structure.box.x / 10).toFixed(2)} × {(structure.box.y / 10).toFixed(2)} × {(structure.box.z / 10).toFixed(2)} nm
          </div>
        )}
      </div>
    </div>
  );
};
