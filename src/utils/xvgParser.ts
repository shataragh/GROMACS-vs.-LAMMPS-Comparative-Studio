import { XvgSeries } from '../types/gromacs';

export function parseXVG(content: string, fallbackTitle = 'Data Series'): XvgSeries {
  const lines = content.split('\n');
  let title = fallbackTitle;
  let xLabel = 'Time';
  let yLabel = 'Value';
  let unitX = 'ps';
  let unitY = '';

  const data: { x: number; y: number }[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('@')) {
      // Grace header metadata
      if (line.includes('title')) {
        const match = line.match(/title\s+"([^"]+)"/);
        if (match) title = match[1];
      } else if (line.includes('xaxis  label')) {
        const match = line.match(/xaxis\s+label\s+"([^"]+)"/);
        if (match) {
          xLabel = match[1];
          const unitMatch = xLabel.match(/\(([^)]+)\)/);
          if (unitMatch) unitX = unitMatch[1];
        }
      } else if (line.includes('yaxis  label')) {
        const match = line.match(/yaxis\s+label\s+"([^"]+)"/);
        if (match) {
          yLabel = match[1];
          const unitMatch = yLabel.match(/\(([^)]+)\)/);
          if (unitMatch) unitY = unitMatch[1];
        }
      }
    } else if (!line.startsWith('#')) {
      // Data line
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);
        if (!isNaN(x) && !isNaN(y)) {
          data.push({ x, y });
        }
      }
    }
  }

  // Calculate statistics
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;

  for (const pt of data) {
    if (pt.y < min) min = pt.y;
    if (pt.y > max) max = pt.y;
    sum += pt.y;
  }

  const mean = data.length > 0 ? sum / data.length : 0;
  let varianceSum = 0;
  for (const pt of data) {
    varianceSum += Math.pow(pt.y - mean, 2);
  }
  const stdDev = data.length > 0 ? Math.sqrt(varianceSum / data.length) : 0;

  return {
    id: `xvg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title,
    xLabel,
    yLabel,
    unitX,
    unitY,
    data,
    stats: {
      min: Math.round(min * 1000) / 1000,
      max: Math.round(max * 1000) / 1000,
      mean: Math.round(mean * 1000) / 1000,
      stdDev: Math.round(stdDev * 1000) / 1000,
    },
  };
}

export function parseGromacsLog(content: string): {
  version?: string;
  totalSteps?: number;
  averageTemperature?: number;
  averagePressure?: number;
  performanceNsPerDay?: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  let version = '';
  let totalSteps: number | undefined;
  let performanceNsPerDay: number | undefined;

  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes('GROMACS version')) {
      version = line.trim();
    } else if (line.includes('WARNING') || line.includes('NOTE') || line.includes('Fatal error')) {
      warnings.push(line.trim());
    } else if (line.includes('Performance:')) {
      const match = line.match(/Performance:\s+([\d.]+)\s+ns\/day/);
      if (match) {
        performanceNsPerDay = parseFloat(match[1]);
      }
    } else if (line.includes('Step') && line.includes('Time')) {
      // Table header
    }
  }

  return {
    version,
    totalSteps,
    performanceNsPerDay,
    warnings: warnings.slice(0, 10),
  };
}
