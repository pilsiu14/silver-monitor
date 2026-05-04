/**
 * Główna strona aplikacji - dashboard.
 * Server Component - pobiera dane z Supabase przy każdym requeście.
 */

import { supabase } from '@/lib/supabase';
import {
  calculateCoverageRatio,
  calculatePaperLeverage,
  calculateShanghaiPremium,
  calculateGoldSilverRatio,
  calculateSqueezeScore,
  getStatusForCoverage,
  getStatusForSqueezeScore,
} from '@/lib/calculations';
import { MetricCard } from '@/components/MetricCard';
import { CoverageChart } from '@/components/CoverageChart';
import { StatusBar } from '@/components/StatusBar';
import { ManualUpdate } from '@/components/ManualUpdate';

// Force dynamic rendering - dane mają być świeże przy każdym wejściu
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  // Najnowszy snapshot COMEX (może być brak)
  const { data: latestComex } = await supabase
    .from('comex_inventory')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single();

  // Najnowsze ceny
  const { data: latestPrice } = await supabase
    .from('prices')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single();

  // Historia coverage ratio - 30 ostatnich punktów
  const { data: history } = await supabase
    .from('comex_inventory')
    .select('recorded_at, registered_oz, open_interest_contracts')
    .order('recorded_at', { ascending: false })
    .limit(30);

  const historyData = (history ?? [])
    .map((row) => ({
      date: new Date(row.recorded_at).toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
      }),
      coverage:
        row.open_interest_contracts > 0
          ? (row.registered_oz / (row.open_interest_contracts * 5000)) * 100
          : 0,
    }))
    .reverse();

  // Wystarczy mieć ceny żeby pokazać dashboard
  const hasAnyData = !!latestPrice;
  const hasComex = !!latestComex;

  // Obliczenia metryk
  const coverage = hasComex ? calculateCoverageRatio(latestComex) : 0;
  const leverage = hasComex ? calculatePaperLeverage(latestComex) : 0;
  const premium = latestPrice
    ? calculateShanghaiPremium({
        spot_western: latestPrice.spot_western ?? 0,
        sge_shanghai: latestPrice.sge_shanghai ?? undefined,
      })
    : { absolute: 0, percentage: 0 };
  const gsr = latestPrice
    ? calculateGoldSilverRatio({
        spot_western: latestPrice.spot_western ?? 0,
        gold_price: latestPrice.gold_price ?? undefined,
      })
    : 0;
  const squeezeScore = hasComex && latestPrice
    ? calculateSqueezeScore(latestComex, {
        spot_western: latestPrice.spot_western ?? 0,
        sge_shanghai: latestPrice.sge_shanghai ?? undefined,
        gold_price: latestPrice.gold_price ?? undefined,
      })
    : 0;

  const coverageStatus = getStatusForCoverage(coverage);
  const squeezeStatus = getStatusForSqueezeScore(squeezeScore);

  // Pokaż czas najświeższej aktualizacji - z prices jeśli brak comex
  const lastUpdateRaw = latestComex?.recorded_at ?? latestPrice?.recorded_at;
  const lastUpdate = lastUpdateRaw
    ? new Date(lastUpdateRaw).toLocaleString('pl-PL')
    : 'brak danych';

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Header */}
      <header className="border-b border-white/10 pb-8 mb-12 flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-4xl font-medium tracking-tight bg-gradient-to-br from-white via-silver to-gray-500 bg-clip-text text-transparent">
            Silver Squeeze Monitor
          </h1>
          <p className="font-mono text-xs text-[#8a8a82] tracking-widest uppercase mt-2">
            COMEX × Shanghai · live · auto-update raz dziennie o 9:00
          </p>
        </div>
        <div className="font-mono text-xs text-[#8a8a82] text-right">
          ostatnia aktualizacja: <span className="text-silver">{lastUpdate}</span>
        </div>
      </header>

      {/* Status bar - tylko jeśli mamy COMEX */}
      {hasComex && (
        <StatusBar
          coverageStatus={coverageStatus}
          squeezeScore={squeezeScore}
          coverage={coverage}
          premium={premium.absolute}
        />
      )}

      {/* Brak danych w ogóle */}
      {!hasAnyData ? (
        <div className="bg-card border border-white/10 rounded-md p-12 text-center">
          <p className="text-[#8a8a82] mb-4">
            Brak danych. Cron job pobierze pierwsze wartości w ciągu najbliższej godziny.
          </p>
          <p className="font-mono text-xs text-[#555550]">
            Możesz też ręcznie odpalić cron: GET /api/cron/fetch-data z headerem CRON_SECRET
          </p>
        </div>
      ) : (
        <>
          {/* Komunikat gdy częściowe dane */}
          {!hasComex && (
            <div className="bg-amber-950/30 border border-amber-500/20 rounded-md p-4 mb-8">
              <p className="text-amber-200 text-sm">
                ⚠ Mamy aktualne ceny, ale dane COMEX (registered/eligible/OI) jeszcze się nie pobrały.
                Coverage ratio i leverage będą widoczne gdy CME scraping się uda lub po ręcznym wpisaniu.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <MetricCard
              label="Coverage"
              value={hasComex ? `${coverage.toFixed(2)}%` : '—'}
              tone={hasComex ? coverageStatus.color : 'neutral'}
              note={hasComex ? coverageStatus.label : 'brak COMEX'}
            />
            <MetricCard
              label="Leverage"
              value={hasComex ? `${leverage.toFixed(2)}×` : '—'}
              tone={hasComex ? (leverage > 8 ? 'red' : leverage > 6 ? 'amber' : 'green') : 'neutral'}
              note={hasComex ? 'papier:metal' : 'brak COMEX'}
            />
            <MetricCard
              label="Spot $"
              value={`$${(latestPrice.spot_western ?? 0).toFixed(2)}`}
              note={`G/S ratio: ${gsr.toFixed(0)}`}
            />
            <MetricCard
              label="SGE Premia"
              value={
                premium.absolute
                  ? `+$${premium.absolute.toFixed(2)}`
                  : 'brak'
              }
              tone={
                premium.absolute > 15
                  ? 'red'
                  : premium.absolute > 8
                  ? 'amber'
                  : 'green'
              }
              note={
                premium.percentage
                  ? `${premium.percentage.toFixed(1)}% nad spot`
                  : 'wpisz ręcznie poniżej'
              }
            />
          </div>

          {/* Squeeze score - duża karta - tylko jeśli mamy COMEX */}
          {hasComex && (
            <div className="bg-card border border-white/10 rounded-lg p-6 mb-8">
              <div className="flex justify-between items-baseline mb-3">
                <h3 className="font-serif text-lg">Squeeze Risk Score</h3>
                <span
                  className="font-mono text-xs px-2 py-1 rounded"
                  style={{
                    background:
                      squeezeStatus.color === 'red'
                        ? '#FCEBEB'
                        : squeezeStatus.color === 'amber'
                        ? '#FAEEDA'
                        : '#E1F5EE',
                    color:
                      squeezeStatus.color === 'red'
                        ? '#791F1F'
                        : squeezeStatus.color === 'amber'
                        ? '#633806'
                        : '#04342C',
                  }}
                >
                  {squeezeStatus.label}
                </span>
              </div>
              <div className="font-serif text-6xl font-medium">
                {squeezeScore}
                <span className="text-[#555550] text-3xl">/100</span>
              </div>
              <div className="mt-4 h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${squeezeScore}%`,
                    background:
                      squeezeScore >= 70
                        ? '#E24B4A'
                        : squeezeScore >= 40
                        ? '#EF9F27'
                        : '#5DCAA5',
                  }}
                />
              </div>
            </div>
          )}

          {/* Wykres - tylko jeśli mamy historię COMEX */}
          {hasComex && historyData.length > 0 && (
            <div className="bg-card border border-white/10 rounded-lg p-6 mb-8">
              <h3 className="font-serif text-lg mb-4">Coverage ratio · 30 dni</h3>
              <CoverageChart data={historyData} />
            </div>
          )}

          {/* Manual update */}
          <ManualUpdate />
        </>
      )}

      <footer className="mt-16 pt-8 border-t border-white/10 text-[#555550] font-mono text-xs leading-relaxed">
        Silver Squeeze Monitor v1.0 · źródła: CME Group, gold-api.com, Investing.com (SHFE),
        Yahoo Finance.
        <br />
        Dane aktualizowane automatycznie raz dziennie o 9:00 przez Vercel Cron. To NIE jest porada inwestycyjna.
      </footer>
    </div>
  );
}
