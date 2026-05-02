/**
 * Obliczenia kluczowych metryk dla rynku srebra.
 * Wszystkie funkcje są pure - nie modyfikują argumentów,
 * łatwe do testowania.
 */

export interface ComexData {
  registered_oz: number;
  eligible_oz: number;
  open_interest_contracts: number;
  front_month_contracts?: number;
}

export interface PriceData {
  spot_western: number;
  sge_shanghai?: number;
  gold_price?: number;
}

const CONTRACT_SIZE = 5000; // oz per kontrakt COMEX silver

/**
 * Coverage ratio: % open interest pokrytego registered silver.
 * <15% = strefa stresu, <10% = krytyczne.
 */
export function calculateCoverageRatio(data: ComexData): number {
  const oiOz = data.open_interest_contracts * CONTRACT_SIZE;
  if (oiOz === 0) return 0;
  return (data.registered_oz / oiOz) * 100;
}

/**
 * Paper leverage: ile razy więcej OI niż registered.
 * >5 = podwyższone, >8 = ekstremalne.
 */
export function calculatePaperLeverage(data: ComexData): number {
  if (data.registered_oz === 0) return 0;
  const oiOz = data.open_interest_contracts * CONTRACT_SIZE;
  return oiOz / data.registered_oz;
}

/**
 * Front-month coverage: pokrycie kontraktów najbliższego miesiąca dostawnego.
 */
export function calculateFrontMonthCoverage(data: ComexData): number {
  if (!data.front_month_contracts) return 100;
  const frontOz = data.front_month_contracts * CONTRACT_SIZE;
  if (frontOz === 0) return 100;
  return (data.registered_oz / frontOz) * 100;
}

/**
 * Premium Shanghai vs Western spot.
 */
export function calculateShanghaiPremium(prices: PriceData): {
  absolute: number;
  percentage: number;
} {
  if (!prices.sge_shanghai || prices.spot_western === 0) {
    return { absolute: 0, percentage: 0 };
  }
  const absolute = prices.sge_shanghai - prices.spot_western;
  const percentage = (absolute / prices.spot_western) * 100;
  return { absolute, percentage };
}

/**
 * Gold/Silver Ratio - klasyczny wskaźnik bullish/bearish srebra.
 */
export function calculateGoldSilverRatio(prices: PriceData): number {
  if (!prices.gold_price || prices.spot_western === 0) return 0;
  return prices.gold_price / prices.spot_western;
}

/**
 * Squeeze Risk Score (0-100) - composite metric.
 * Łączy 4 wskaźniki w jedną liczbę pokazującą ryzyko squeeze.
 */
export function calculateSqueezeScore(
  comex: ComexData,
  prices: PriceData
): number {
  let score = 0;

  // Coverage ratio (40% wagi)
  const coverage = calculateCoverageRatio(comex);
  if (coverage < 10) score += 40;
  else if (coverage < 15) score += 30;
  else if (coverage < 20) score += 15;
  else if (coverage < 25) score += 5;

  // Paper leverage (20% wagi)
  const leverage = calculatePaperLeverage(comex);
  if (leverage > 8) score += 20;
  else if (leverage > 6) score += 15;
  else if (leverage > 4) score += 8;

  // Shanghai premium (25% wagi)
  const premium = calculateShanghaiPremium(prices).absolute;
  if (premium > 15) score += 25;
  else if (premium > 8) score += 18;
  else if (premium > 3) score += 8;

  // Registered absolute level (15% wagi)
  const regM = comex.registered_oz / 1_000_000;
  if (regM < 30) score += 15;
  else if (regM < 50) score += 10;
  else if (regM < 80) score += 5;

  return Math.round(score);
}

/**
 * Status string na podstawie metryki - do wyświetlania w UI.
 */
export function getStatusForCoverage(coverage: number): {
  label: string;
  color: 'red' | 'amber' | 'green';
} {
  if (coverage < 12) return { label: 'CRITICAL', color: 'red' };
  if (coverage < 15) return { label: 'STRESS', color: 'red' };
  if (coverage < 20) return { label: 'TIGHT', color: 'amber' };
  return { label: 'OK', color: 'green' };
}

export function getStatusForSqueezeScore(score: number): {
  label: string;
  color: 'red' | 'amber' | 'green';
} {
  if (score >= 70) return { label: 'HIGH RISK', color: 'red' };
  if (score >= 40) return { label: 'MODERATE', color: 'amber' };
  return { label: 'LOW', color: 'green' };
}
