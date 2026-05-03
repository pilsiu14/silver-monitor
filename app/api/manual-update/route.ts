/**
 * Endpoint do ręcznego wpisywania ceny Shanghai (gdy auto scraping zawiedzie).
 * POST /api/manual-update
 * body: { sge_shanghai: 82.10 }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { sge_shanghai } = body;

    if (typeof sge_shanghai !== 'number' || sge_shanghai < 30 || sge_shanghai > 200) {
      return NextResponse.json(
        { error: 'Invalid sge_shanghai value (expected 30-200)' },
        { status: 400 }
      );
    }

    // Pobierz ostatnią cenę Western żeby policzyć premia
    const { data: lastPrice } = await supabaseAdmin
      .from('prices')
      .select('spot_western, gold_price')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    const { error } = await supabaseAdmin.from('prices').insert({
      spot_western: lastPrice?.spot_western ?? null,
      gold_price: lastPrice?.gold_price ?? null,
      sge_shanghai,
      source: 'manual',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sge_shanghai });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
