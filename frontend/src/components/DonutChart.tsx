import { useId } from 'react';

interface Segment { label: string; value: number; color: string; }

export default function DonutChart({ data, size = 180 }: { data: Segment[]; size?: number }) {
  const id = useId().replace(/:/g, '');
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center space-x-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.filter(d => d.value > 0).map((seg, i) => {
          const pct = seg.value / total;
          const dashLen = circumference * pct;
          const dashOff = -offset;
          offset += dashLen;
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={seg.color} strokeWidth="20" strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={dashOff} transform={`rotate(-90 ${cx} ${cy})`} opacity={0.85} />
          );
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-white text-lg font-bold">{data.length}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-slate-400 text-[10px]">categories</text>
      </svg>
      <div className="space-y-1.5">
        {data.filter(d => d.value > 0).map((seg, i) => (
          <div key={i} className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-xs text-slate-300 whitespace-nowrap">{seg.label}</span>
            <span className="text-xs text-slate-500">{((seg.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
