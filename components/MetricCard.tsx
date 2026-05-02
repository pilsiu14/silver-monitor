'use client';

interface MetricCardProps {
  label: string;
  value: string;
  tone?: 'red' | 'amber' | 'green' | 'neutral';
  note?: string;
}

const toneColors = {
  red: '#A32D2D',
  amber: '#854F0B',
  green: '#3B6D11',
  neutral: '#e8e8e3',
};

export function MetricCard({ label, value, tone = 'neutral', note }: MetricCardProps) {
  const color = toneColors[tone];
  return (
    <div className="bg-card border border-white/10 rounded-md p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#8a8a82] mb-2">
        {label}
      </div>
      <div
        className="font-serif text-2xl font-medium leading-none"
        style={{ color }}
      >
        {value}
      </div>
      {note && (
        <div
          className="font-mono text-[10px] mt-2"
          style={{ color: tone === 'neutral' ? '#8a8a82' : color }}
        >
          {note}
        </div>
      )}
    </div>
  );
}
