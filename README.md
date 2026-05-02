# Silver Squeeze Monitor

Personal dashboard tracking COMEX silver inventory, Shanghai premium, and short squeeze indicators.

Auto-aktualizacja danych co 2 godziny przez Vercel Cron.

## Tech stack

- Next.js 14 (App Router)
- TypeScript
- Supabase (PostgreSQL)
- Tailwind CSS
- Recharts
- Vercel hosting + Cron

## Data sources

- **Spot price (Western)**: gold-api.com (free, no key)
- **COMEX inventory**: scraping CME Daily Stocks XLS
- **Open Interest**: Yahoo Finance (SI=F)
- **Shanghai price**: scraping investing.com SHFE futures (with Yahoo fallback)
- **Manual override**: jeśli auto-scraping zawiedzie, jest formularz w UI

## Lokalne uruchomienie

```bash
npm install
cp .env.example .env.local
# Wpisz prawdziwe klucze Supabase do .env.local
npm run dev
```

Otwórz http://localhost:3000

## Deploy na Vercel

1. Wgraj kod na GitHub (już zrobione jeśli to czytasz)
2. Wejdź na vercel.com → New Project → Import z GitHub → wybierz to repo
3. W "Environment Variables" dodaj:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` (losowy ciąg, np. z generate-secret.vercel.app/32)
   - `TELEGRAM_BOT_TOKEN` (opcjonalne)
   - `TELEGRAM_CHAT_ID` (opcjonalne)
4. Deploy

## Manualnie wywołać cron (test)

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/fetch-data
```

## Schema bazy danych

Patrz: poprzednio uruchomiony SQL w Supabase (5 tabel: comex_inventory, prices, cot_reports, alerts_log, alert_config).

## License

Personal project. Not financial advice.
