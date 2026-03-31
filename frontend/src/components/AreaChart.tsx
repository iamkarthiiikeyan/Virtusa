import { useId } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface AreaChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
}

export default function AreaChart({ data, color = '#06b6d4', height = 200 }: AreaChartProps) {
  const gradientId = useId().replace(/:/g, ''); // Unique ID per instance

  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;
  const width = 100;
  const padding = 10;

  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((point.value - minValue) / range) * (height - padding * 2) - padding;
    return { x, y, value: point.value };
  });

  const pathD = points.reduce((path, point, index) => {
    const command = index === 0 ? 'M' : 'L';
    return `${path} ${command} ${point.x} ${point.y}`;
  }, '');

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: `${height}px` }}>
        <defs>
          <linearGradient id={`areaGrad-${gradientId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#areaGrad-${gradientId})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r="3" fill={color} className="cursor-pointer" />
        ))}
      </svg>
      <div className="flex justify-between mt-2">
        {data.map((point, index) => (
          <span key={index} className="text-xs text-slate-500">{point.label}</span>
        ))}
      </div>
    </div>
  );
}
