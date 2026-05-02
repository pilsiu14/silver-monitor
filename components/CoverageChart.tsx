'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface CoverageChartProps {
  data: { date: string; coverage: number }[];
}

export function CoverageChart({ data }: CoverageChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-[#555550] font-mono text-xs">
        Brak historii — czekaj na pierwsze cron runs
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#8a8a82', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            stroke="rgba(255,255,255,0.1)"
          />
          <YAxis
            tick={{ fill: '#8a8a82', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            stroke="rgba(255,255,255,0.1)"
            tickFormatter={(v) => `${v.toFixed(1)}%`}
            domain={['dataMin - 1', 'dataMax + 1']}
          />
          <Tooltip
            contentStyle={{
              background: '#131316',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 4,
              fontFamily: 'JetBrains Mono',
              fontSize: 12,
            }}
            formatter={(value: number) => [`${value.toFixed(2)}%`, 'Coverage']}
          />
          <ReferenceLine
            y={15}
            stroke="#888780"
            strokeDasharray="4 4"
            label={{
              value: 'Próg 15%',
              fill: '#8a8a82',
              fontSize: 10,
              position: 'right',
            }}
          />
          <Line
            type="monotone"
            dataKey="coverage"
            stroke="#E24B4A"
            strokeWidth={2}
            dot={{ fill: '#E24B4A', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
