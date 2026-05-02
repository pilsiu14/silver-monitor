'use client';

interface StatusBarProps {
  coverageStatus: { label: string; color: 'red' | 'amber' | 'green' };
  squeezeScore: number;
  coverage: number;
  premium: number;
}

export function StatusBar({
  coverageStatus,
  squeezeScore,
  coverage,
  premium,
}: StatusBarProps) {
  const isRed = coverageStatus.color === 'red' || squeezeScore >= 70;

  if (!isRed) return null;

  return (
    <div className="bg-[#FCEBEB] rounded-md p-4 mb-6 flex items-center gap-3 flex-wrap">
      <span className="bg-[#E24B4A] text-white px-2 py-0.5 rounded font-mono text-[10px] font-medium tracking-wider">
        SQUEEZE WATCH
      </span>
      <span className="text-[#501313] text-sm">
        Coverage ratio {coverage.toFixed(2)}%
        {premium > 0 ? ` · Premia Shanghai $${premium.toFixed(2)}` : ''}
        {' · Score '}
        {squeezeScore}/100
      </span>
    </div>
  );
}
