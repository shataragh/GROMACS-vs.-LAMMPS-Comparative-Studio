import React, { useEffect, useRef, useState } from 'react';
import { MoleculeStructure } from '../types/gromacs';
import { Activity, Flame, Pause, Play, RefreshCw, Sliders, Zap } from 'lucide-react';

interface InteractiveSimulationProps {
  structure: MoleculeStructure | null;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  mass: number;
  radius: number;
  color: string;
  resSeq: number;
}

interface Bond {
  i: number;
  j: number;
  r0: number; // Equilibrium distance
  k: number;  // Spring constant
}

export const InteractiveSimulation: React.FC<InteractiveSimulationProps> = ({ structure }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [targetTemp, setTargetTemp] = useState<number>(300);
  const [timeStep, setTimeStep] = useState<number>(1.0); // fs
  const [currentTemp, setCurrentTemp] = useState<number>(300);
  const [potentialEnergy, setPotentialEnergy] = useState<number>(0);
  const [kineticEnergy, setKineticEnergy] = useState<number>(0);
  const [totalEnergy, setTotalEnergy] = useState<number>(0);
  const [elapsedSteps, setElapsedSteps] = useState<number>(0);

  // Simulation physics state
  const particlesRef = useRef<Particle[]>([]);
  const bondsRef = useRef<Bond[]>([]);
  const energyHistoryRef = useRef<{ step: number; epot: number; ekin: number; temp: number }[]>([]);
  const isDraggingParticleRef = useRef<number | null>(null);

  // Initialize 2D projection simulation from structure C-alpha backbone
  const initSimulation = () => {
    const particles: Particle[] = [];
    const bonds: Bond[] = [];

    // Use backbone CA atoms or first 40 atoms
    const sourceAtoms = structure && structure.atoms.length > 0
      ? (structure.atoms.filter(a => a.name === 'CA').length > 4 
          ? structure.atoms.filter(a => a.name === 'CA') 
          : structure.atoms.slice(0, 35))
      : [];

    const width = 500;
    const height = 400;

    if (sourceAtoms.length > 0) {
      // Find bounding box
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      sourceAtoms.forEach(a => {
        if (a.x < minX) minX = a.x;
        if (a.x > maxX) maxX = a.x;
        if (a.y < minY) minY = a.y;
        if (a.y > maxY) maxY = a.y;
      });

      const spanX = Math.max(1, maxX - minX);
      const spanY = Math.max(1, maxY - minY);
      const scale = Math.min((width - 120) / spanX, (height - 120) / spanY);

      sourceAtoms.forEach((a, i) => {
        const x = 60 + (a.x - minX) * scale;
        const y = 60 + (a.y - minY) * scale;
        // Thermal initial velocity
        const vScale = Math.sqrt(targetTemp / 300) * 1.5;
        const vx = (Math.random() - 0.5) * vScale;
        const vy = (Math.random() - 0.5) * vScale;

        particles.push({
          id: a.id,
          x,
          y,
          vx,
          vy,
          fx: 0,
          fy: 0,
          mass: 12.0, // Carbon approx
          radius: 7.0,
          color: a.resName === 'ARG' || a.resName === 'LYS' ? '#3B82F6' : (a.resName === 'ASP' || a.resName === 'GLU' ? '#EF4444' : '#06B6D4'),
          resSeq: a.resSeq,
        });

        // Add bond with previous particle along chain
        if (i > 0) {
          const prev = particles[i - 1];
          const dist = Math.hypot(x - prev.x, y - prev.y);
          bonds.push({
            i: i - 1,
            j: i,
            r0: Math.max(15, Math.min(45, dist)),
            k: 0.15,
          });
        }
      });
    } else {
      // Synthetic peptide hairpin if no structure
      const count = 24;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const x = width / 2 + Math.cos(angle) * 100;
        const y = height / 2 + Math.sin(angle) * 70;
        particles.push({
          id: i,
          x,
          y,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          fx: 0,
          fy: 0,
          mass: 12.0,
          radius: 7,
          color: i % 2 === 0 ? '#06B6D4' : '#F59E0B',
          resSeq: i + 1,
        });
        if (i > 0) {
          bonds.push({ i: i - 1, j: i, r0: 25, k: 0.15 });
        }
      }
    }

    particlesRef.current = particles;
    bondsRef.current = bonds;
    energyHistoryRef.current = [];
    setElapsedSteps(0);
  };

  useEffect(() => {
    initSimulation();
  }, [structure]);

  // Main Physics Engine (Velocity-Verlet Integration with Lennard-Jones + Harmonic Bonds)
  useEffect(() => {
    let animId: number;
    let stepCount = 0;

    const integrate = () => {
      if (isRunning && particlesRef.current.length > 0) {
        const particles = particlesRef.current;
        const bonds = bondsRef.current;
        const N = particles.length;
        const dt = (timeStep * 0.05); // scaled simulation time
        const boxWidth = 500;
        const boxHeight = 400;

        // 1. Reset forces and compute potentials
        let epot = 0;
        for (let i = 0; i < N; i++) {
          particles[i].fx = 0;
          particles[i].fy = 0;
        }

        // Harmonic Bond Forces
        for (const bond of bonds) {
          const p1 = particles[bond.i];
          const p2 = particles[bond.j];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.hypot(dx, dy) || 0.01;
          const diff = dist - bond.r0;
          
          epot += 0.5 * bond.k * diff * diff;

          const f = bond.k * diff;
          const fx = f * (dx / dist);
          const fy = f * (dy / dist);

          p1.fx += fx;
          p1.fy += fy;
          p2.fx -= fx;
          p2.fy -= fy;
        }

        // Lennard-Jones 12-6 Non-bonded Forces
        const epsilon = 0.5;
        const sigma = 14.0;
        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            // Ignore 1-2 bonded neighbors
            const isBonded = bonds.some(b => (b.i === i && b.j === j) || (b.i === j && b.j === i));
            if (isBonded) continue;

            const dx = particles[j].x - particles[i].x;
            const dy = particles[j].y - particles[i].y;
            const r2 = dx * dx + dy * dy;
            if (r2 < 20000 && r2 > 1) {
              const r = Math.sqrt(r2);
              const s_r = sigma / r;
              const s_r6 = Math.pow(s_r, 6);
              const s_r12 = s_r6 * s_r6;

              epot += 4 * epsilon * (s_r12 - s_r6);

              // Force = -dE/dr = 4*eps*(12*sigma^12/r^13 - 6*sigma^6/r^7)
              const fMag = (24 * epsilon / r) * (2 * s_r12 - s_r6);
              const fx = fMag * (dx / r);
              const fy = fMag * (dy / r);

              particles[i].fx -= fx;
              particles[i].fy -= fy;
              particles[j].fx += fx;
              particles[j].fy += fy;
            }
          }
        }

        // Wall Soft Potential (Container Box)
        for (const p of particles) {
          const margin = 20;
          if (p.x < margin) p.fx += (margin - p.x) * 0.4;
          if (p.x > boxWidth - margin) p.fx -= (p.x - (boxWidth - margin)) * 0.4;
          if (p.y < margin) p.fy += (margin - p.y) * 0.4;
          if (p.y > boxHeight - margin) p.fy -= (p.y - (boxHeight - margin)) * 0.4;
        }

        // 2. Velocity-Verlet Update
        let ekin = 0;
        for (let i = 0; i < N; i++) {
          const p = particles[i];
          if (isDraggingParticleRef.current === i) continue; // Skip dragged particle

          // Update position
          p.x += p.vx * dt + 0.5 * (p.fx / p.mass) * dt * dt;
          p.y += p.vy * dt + 0.5 * (p.fy / p.mass) * dt * dt;

          // Update velocity
          p.vx += (p.fx / p.mass) * dt;
          p.vy += (p.fy / p.mass) * dt;

          ekin += 0.5 * p.mass * (p.vx * p.vx + p.vy * p.vy);
        }

        // 3. Berendsen Velocity-Rescaling Thermostat
        const currentT = Math.max(1, (2 * ekin) / (2 * N * 0.05)); // 2D DOF approximation
        const tau = 10.0;
        const lambda = Math.sqrt(1 + (dt / tau) * (targetTemp / currentT - 1));
        const safeLambda = Math.max(0.7, Math.min(1.3, lambda));

        for (const p of particles) {
          p.vx *= safeLambda;
          p.vy *= safeLambda;
        }

        stepCount++;
        if (stepCount % 2 === 0) {
          setCurrentTemp(Math.round(currentT));
          setPotentialEnergy(Math.round(epot));
          setKineticEnergy(Math.round(ekin));
          setTotalEnergy(Math.round(epot + ekin));
          setElapsedSteps(prev => prev + 2);

          energyHistoryRef.current.push({
            step: stepCount,
            epot,
            ekin,
            temp: currentT,
          });
          if (energyHistoryRef.current.length > 120) {
            energyHistoryRef.current.shift();
          }
        }

        // 4. Render Simulation Canvas
        renderCanvas();
        renderChart();
      }

      animId = requestAnimationFrame(integrate);
    };

    animId = requestAnimationFrame(integrate);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, targetTemp, timeStep]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle simulation grid
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    const particles = particlesRef.current;
    const bonds = bondsRef.current;

    // Draw Bonds
    for (const bond of bonds) {
      const p1 = particles[bond.i];
      const p2 = particles[bond.j];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const stress = Math.abs(dist - bond.r0) / bond.r0;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = stress > 0.4 ? '#EF4444' : '#475569';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Draw Particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Velocity vectors
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 4, p.y + p.vy * 4);
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  };

  const renderChart = () => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const history = energyHistoryRef.current;
    if (history.length < 2) return;

    const w = canvas.width;
    const h = canvas.height;

    // Min and Max for scaling
    let minE = Infinity, maxE = -Infinity;
    history.forEach(item => {
      const tot = item.epot + item.ekin;
      if (item.epot < minE) minE = item.epot;
      if (tot > maxE) maxE = tot;
    });

    const range = Math.max(10, maxE - minE);

    // Plot Potential Energy (Cyan)
    ctx.beginPath();
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 1.5;
    history.forEach((pt, idx) => {
      const x = (idx / (history.length - 1)) * w;
      const y = h - ((pt.epot - minE) / range) * (h - 20) - 10;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Plot Total Energy (White)
    ctx.beginPath();
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 1.5;
    history.forEach((pt, idx) => {
      const x = (idx / (history.length - 1)) * w;
      const tot = pt.epot + pt.ekin;
      const y = h - ((tot - minE) / range) * (h - 20) - 10;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  // Particle Drag Interaction
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    particlesRef.current.forEach((p, idx) => {
      if (Math.hypot(p.x - mx, p.y - my) < p.radius + 6) {
        isDraggingParticleRef.current = idx;
      }
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingParticleRef.current === null) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = particlesRef.current[isDraggingParticleRef.current];
    if (p) {
      p.x = e.clientX - rect.left;
      p.y = e.clientY - rect.top;
      p.vx = 0;
      p.vy = 0;
    }
  };

  const handleMouseUp = () => {
    isDraggingParticleRef.current = null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Simulation Stage */}
      <div className="lg:col-span-8 space-y-3">
        <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-[#07090E]">
          {/* Top Stage Control HUD */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
            <div className="flex items-center gap-2 p-1 bg-slate-900/90 backdrop-blur border border-slate-700/60 rounded-lg pointer-events-auto">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`p-1.5 rounded transition-colors text-xs font-mono flex items-center gap-1.5 ${
                  isRunning ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isRunning ? 'Pause Engine' : 'Resume'}</span>
              </button>

              <button
                onClick={initSimulation}
                title="Reset Coordinates & Velocities"
                className="p-1.5 rounded text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-slate-900/90 backdrop-blur border border-slate-700/60 px-3 py-1 rounded-lg text-xs font-mono text-slate-300 flex items-center gap-2 pointer-events-auto">
              <span className="text-cyan-400">Step:</span>
              <span className="tabular-nums font-semibold">{elapsedSteps}</span>
              <span>·</span>
              <span className="text-amber-400">dt:</span>
              <span className="tabular-nums font-semibold">{timeStep.toFixed(1)} fs</span>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={500}
            height={380}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="w-full h-[380px] cursor-crosshair block"
          />

          <div className="p-2.5 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>● Click and drag any atom in the viewport to apply external pull forces</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" /> Residue</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-amber-400" /> Velocity</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-slate-500" /> Covalent Bond</span>
            </div>
          </div>
        </div>

        {/* Real-time Rolling Energy Strip Chart */}
        <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/50 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Energy Conservation (Velocity-Verlet)</span>
            </span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-cyan-400"><span className="w-2 h-2 rounded-full bg-cyan-400" /> Epot</span>
              <span className="flex items-center gap-1 text-slate-200"><span className="w-2 h-2 rounded-full bg-white" /> Etot (Conserved)</span>
            </div>
          </div>
          <canvas
            ref={chartCanvasRef}
            width={500}
            height={90}
            className="w-full h-[90px] rounded border border-slate-800 bg-[#07090E] block"
          />
        </div>
      </div>

      {/* Physics & Thermostat Controls */}
      <div className="lg:col-span-4 space-y-4">
        {/* Telemetry Metrics */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3.5 font-mono">
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400 block border-b border-slate-800/80 pb-2">
            Instantaneous Thermodynamics
          </span>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Instant Temp (T):</span>
              <span className="text-white font-semibold text-sm tabular-nums">
                {currentTemp} <span className="text-slate-500 text-xs">K</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Potential Energy:</span>
              <span className="text-cyan-400 font-semibold tabular-nums">
                {potentialEnergy} <span className="text-slate-500 text-xs">kJ/mol</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Kinetic Energy:</span>
              <span className="text-amber-400 font-semibold tabular-nums">
                {kineticEnergy} <span className="text-slate-500 text-xs">kJ/mol</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-2">
              <span className="text-slate-300 font-medium">Total Energy:</span>
              <span className="text-white font-bold text-sm tabular-nums">
                {totalEnergy} <span className="text-slate-500 text-xs">kJ/mol</span>
              </span>
            </div>
          </div>
        </div>

        {/* Thermostat Scrubbers */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Thermostat Coupling</span>
            </span>
            <span className="text-xs font-mono text-cyan-400 tabular-nums">{targetTemp} K</span>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min="50"
              max="650"
              step="10"
              value={targetTemp}
              onChange={(e) => setTargetTemp(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>50 K (Cryo)</span>
              <span>300 K (Ambient)</span>
              <span>650 K (Denature)</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Integration Step:</span>
              <span className="text-slate-200 tabular-nums">{timeStep.toFixed(1)} fs</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.5"
              value={timeStep}
              onChange={(e) => setTimeStep(parseFloat(e.target.value))}
              className="w-full accent-cyan-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
