'use client';

import { useState } from 'react';

export function ManualUpdate() {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit() {
    const num = parseFloat(value);
    if (isNaN(num) || num < 30 || num > 200) {
      setStatus('err');
      setMessage('Wpisz cenę w zakresie 30-200 USD/oz');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch('/api/manual-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sge_shanghai: num }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus('ok');
        setMessage(`Zapisano: $${num.toFixed(2)}. Odśwież stronę aby zobaczyć.`);
        setValue('');
      } else {
        setStatus('err');
        setMessage(data.error || 'Błąd');
      }
    } catch (e: any) {
      setStatus('err');
      setMessage(e.message);
    }
  }

  return (
    <div className="bg-card border border-white/10 rounded-lg p-6 mb-8">
      <h3 className="font-serif text-lg mb-2">Ręczna aktualizacja Shanghai</h3>
      <p className="text-[#8a8a82] text-sm mb-4">
        Gdy auto-scraping zawiedzie, wpisz cenę z{' '}
        <a
          href="https://metalprices.live/shanghai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#5b9bd5] hover:underline"
        >
          metalprices.live/shanghai
        </a>{' '}
        ręcznie.
      </p>
      <div className="flex gap-2">
        <input
          type="number"
          step="0.01"
          placeholder="np. 82.10"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 bg-bg border border-white/10 rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-silver"
        />
        <button
          onClick={handleSubmit}
          disabled={status === 'loading'}
          className="bg-white/5 border border-white/10 hover:border-silver hover:bg-white/10 px-4 py-2 rounded font-mono text-xs disabled:opacity-50 transition-colors"
        >
          {status === 'loading' ? 'Zapisuję...' : 'Zapisz cenę SGE'}
        </button>
      </div>
      {message && (
        <p
          className="mt-3 text-xs font-mono"
          style={{
            color: status === 'ok' ? '#5dcaa5' : status === 'err' ? '#e24b4a' : '#8a8a82',
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
