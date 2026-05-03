/**
 * Cron job endpoint - wywoływany przez Vercel Cron co 2h.
 * Pobiera wszystkie dane i zapisuje do Supabase.
 *
 * Vercel Cron wywołuje GET /api/cron/fetch-data
 * z header Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  fetchSpotPrice,
  fetchComexInventory,
  fetchOpenInterest,
  fetchShanghaiPrice,
} from '@/lib/fetchers';

// Vercel Cron timeout limit
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Sprawdzenie sekretu - tylko Vercel Cron może to wywołać
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase admin not configured' },
      { status: 500 }
    );
  }

  const startTime = Date.now();
  const results: Record<string, any> = {};

  try {
    // Pobieramy wszystkie dane równolegle - oszczędza czas
    const [prices, inventory, oi, shanghaiPrice] = await Promise.all([
      fetchSpotPrice(),
      fetchComexInventory(),
      fetchOpenInterest(),
      fetchShanghaiPrice(),
    ]);

    results.prices = prices;
    results.inventory = inventory;
    results.oi = oi;
    results.shanghaiPrice = shanghaiPrice;

    // Zapisujemy ceny - jeśli mamy spot price, zapisujemy snapshot
    if (prices.silver !== null) {
      const { error: priceError } = await supabaseAdmin.from('prices').insert({
        spot_western: prices.silver,
        gold_price: prices.gold,
        sge_shanghai: shanghaiPrice ?? null,
        source: 'cron',
      });
      if (priceError) results.priceError = priceError.message;
      else results.pricesSaved = true;
    }

    // Zapisujemy COMEX inventory - tylko jeśli mamy oba (registered i OI)
    if (
      inventory.registered_oz !== null &&
      inventory.eligible_oz !== null &&
      oi !== null
    ) {
      const { error: comexError } = await supabaseAdmin
        .from('comex_inventory')
        .insert({
          registered_oz: inventory.registered_oz,
          eligible_oz: inventory.eligible_oz,
          open_interest_contracts: oi,
          source: 'cron',
        });
      if (comexError) results.comexError = comexError.message;
      else results.comexSaved = true;
    }

    // Sprawdzenie alertów - czy nie przekroczyliśmy progów
    if (
      inventory.registered_oz !== null &&
      oi !== null &&
      prices.silver !== null
    ) {
      const oiOz = oi * 5000;
      const coverage = (inventory.registered_oz / oiOz) * 100;
      const leverage = oiOz / inventory.registered_oz;
      const premium = shanghaiPrice ? shanghaiPrice - prices.silver : 0;

      const triggeredAlerts: string[] = [];

      if (coverage < 12) {
        triggeredAlerts.push(`Coverage ratio CRITICAL: ${coverage.toFixed(2)}%`);
      } else if (coverage < 15) {
        triggeredAlerts.push(`Coverage ratio STRESS: ${coverage.toFixed(2)}%`);
      }

      if (leverage > 8) {
        triggeredAlerts.push(`Paper leverage EXTREME: ${leverage.toFixed(2)}x`);
      }

      if (premium > 15) {
        triggeredAlerts.push(`Shanghai premium CRITICAL: $${premium.toFixed(2)}`);
      }

      if (inventory.registered_oz < 25_000_000) {
        triggeredAlerts.push(
          `Registered silver CRITICAL: ${(inventory.registered_oz / 1_000_000).toFixed(2)}M oz`
        );
      }

      // Zapisz alerty + wyślij Telegram (jeśli skonfigurowany)
      for (const alertMsg of triggeredAlerts) {
        await supabaseAdmin.from('alerts_log').insert({
          alert_type: 'threshold',
          severity: alertMsg.includes('CRITICAL') ? 'critical' : 'warning',
          message: alertMsg,
        });

        // Telegram alert
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
          try {
            await fetch(
              `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: process.env.TELEGRAM_CHAT_ID,
                  text: `🥈 SILVER ALERT\n\n${alertMsg}`,
                  parse_mode: 'HTML',
                }),
                signal: AbortSignal.timeout(5000),
              }
            );
          } catch (e) {
            console.error('Telegram send failed', e);
          }
        }
      }

      results.alerts = triggeredAlerts;
    }

    results.durationMs = Date.now() - startTime;
    return NextResponse.json({ ok: true, results });
  } catch (error: any) {
    console.error('[cron/fetch-data]', error);
    return NextResponse.json(
      { ok: false, error: error.message, partial: results },
      { status: 500 }
    );
  }
}
