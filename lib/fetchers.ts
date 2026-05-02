/**
 * Funkcje pobierające dane z zewnętrznych źródeł.
 * Każda funkcja jest "fault-tolerant" - łapie błędy
 * i zwraca null zamiast crashować, żeby cron job nie padał.
 */

import * as cheerio from 'cheerio';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Pobranie aktualnej ceny srebra (Western spot).
 * Źródło: gold-api.com - bezpłatne, bez klucza, bez limitów.
 */
export async function fetchSpotPrice(): Promise<{
  silver: number | null;
  gold: number | null;
}> {
  try {
    const [silverRes, goldRes] = await Promise.all([
      fetch('https://api.gold-api.com/price/XAG', {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(10000),
      }),
      fetch('https://api.gold-api.com/price/XAU', {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(10000),
      }),
    ]);

    if (!silverRes.ok || !goldRes.ok) {
      throw new Error('gold-api returned non-200');
    }

    const silverData = await silverRes.json();
    const goldData = await goldRes.json();

    return {
      silver: typeof silverData.price === 'number' ? silverData.price : null,
      gold: typeof goldData.price === 'number' ? goldData.price : null,
    };
  } catch (error) {
    console.error('[fetchSpotPrice]', error);
    return { silver: null, gold: null };
  }
}

/**
 * COMEX Silver Daily Stocks - registered/eligible inventory.
 * Źródło: CME Group XLS file, parsowany jako tekst CSV.
 *
 * UWAGA: CME publikuje XLS z zawartością XML, którą można sparsować
 * heuristycznie szukając kluczowych słów.
 */
export async function fetchComexInventory(): Promise<{
  registered_oz: number | null;
  eligible_oz: number | null;
}> {
  try {
    const url = 'https://www.cmegroup.com/delivery_reports/Silver_stocks.xls';
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`CME returned ${res.status}`);
    }

    const text = await res.text();

    // Heurystyka: szukamy linii zawierających "TOTAL" + numerów
    // Format CME XLS to XML SpreadsheetML, dane są w tagach <Data>
    const lines = text
      .split(/[\n\r]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let registered = 0;
    let eligible = 0;

    // Szukamy wzorca "Total Registered" i "Total Eligible" + następne liczby
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('total') && line.includes('registered')) {
        const match = lines[i].match(/[\d,]+(\.\d+)?/g);
        if (match) {
          const numbers = match.map((m) => parseFloat(m.replace(/,/g, '')));
          const big = numbers.find((n) => n > 1_000_000);
          if (big) registered = big;
        }
      }
      if (line.includes('total') && line.includes('eligible')) {
        const match = lines[i].match(/[\d,]+(\.\d+)?/g);
        if (match) {
          const numbers = match.map((m) => parseFloat(m.replace(/,/g, '')));
          const big = numbers.find((n) => n > 1_000_000);
          if (big) eligible = big;
        }
      }
    }

    if (registered === 0 || eligible === 0) {
      throw new Error('Could not parse CME XLS');
    }

    return {
      registered_oz: registered,
      eligible_oz: eligible,
    };
  } catch (error) {
    console.error('[fetchComexInventory]', error);
    return { registered_oz: null, eligible_oz: null };
  }
}

/**
 * Open interest dla COMEX silver futures.
 * Source: CME public data via Yahoo Finance proxy (SI=F symbol).
 */
export async function fetchOpenInterest(): Promise<number | null> {
  try {
    // Yahoo Finance v8 endpoint (nieoficjalne ale stabilne od lat)
    const url =
      'https://query1.finance.yahoo.com/v7/finance/options/SI=F';
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`Yahoo returned ${res.status}`);

    const data = await res.json();
    const oi = data?.optionChain?.result?.[0]?.quote?.openInterest;

    return typeof oi === 'number' ? oi : null;
  } catch (error) {
    console.error('[fetchOpenInterest]', error);
    return null;
  }
}

/**
 * Shanghai silver price - z investing.com.
 * Próbujemy 2 sources, fallback na null.
 */
export async function fetchShanghaiPrice(): Promise<number | null> {
  // Source 1: investing.com SHFE silver futures
  try {
    const url = 'https://www.investing.com/commodities/shfe-silver-futures';
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      // Investing.com używa data-test atrybutów dla ceny
      const priceText = $('[data-test="instrument-price-last"]').first().text();
      const price = parseFloat(priceText.replace(/[^\d.]/g, ''));

      if (!isNaN(price) && price > 0) {
        // SHFE notuje w juanach za kg, przeliczamy na USD/oz
        // 1 oz = 31.1035 g, więc juan/kg ÷ 32.15 = juan/oz
        // Potem dzielimy przez kurs USD/CNY (~7.2)
        const usdPerOz = price / 32.15 / 7.2;
        if (usdPerOz > 30 && usdPerOz < 200) {
          // sanity check - cena srebra powinna być w tym zakresie
          return usdPerOz;
        }
      }
    }
  } catch (error) {
    console.error('[fetchShanghaiPrice investing]', error);
  }

  // Source 2: Yahoo Finance fallback - SHFE silver
  try {
    const url =
      'https://query1.finance.yahoo.com/v8/finance/chart/AGc1.SHF?interval=1d';
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = await res.json();
      const price =
        data?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (typeof price === 'number' && price > 0) {
        const usdPerOz = price / 32.15 / 7.2;
        if (usdPerOz > 30 && usdPerOz < 200) {
          return usdPerOz;
        }
      }
    }
  } catch (error) {
    console.error('[fetchShanghaiPrice yahoo]', error);
  }

  return null;
}
