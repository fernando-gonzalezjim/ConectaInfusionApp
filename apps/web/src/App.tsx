import { useEffect, useState } from 'react';
import type { StudioOverview } from '@conecta/contracts';

export function App() {
  const [data, setData] = useState<StudioOverview | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch('/api/v1/studio/overview', { signal: controller.signal })
      .then(res => { if (!res.ok) throw new Error('Unable to load studio data. Check the API, PostgreSQL connection, and database migrations.'); return res.json() as Promise<StudioOverview>; })
      .then(setData)
      .catch((err: Error) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [attempt]);
  return <main>
    <header><a className="brand" href="/">conecta <span>infusion</span></a><span>STUDIO & COFFEE</span></header>
    <section className="hero"><p className="eyebrow">SPACE TO BREATHE. ROOM TO GROW.</p><h1>A little balance,<br />every day.</h1><p>Your yoga studio and coffee shop, together in one place.</p><span className="badge">Studio workspace · PostgreSQL</span></section>
    {error ? <div role="alert" className="notice">{error} <button onClick={() => setAttempt(a => a + 1)}>Try again</button></div> : !data ? <p role="status">Loading your studio…</p> : <>
      <section className="stats" aria-label="Displayed studio summary"><article><strong>{data.classes.length}</strong><span>Upcoming classes shown</span></article><article><strong>{data.classes.reduce((sum, item) => sum + item.booked, 0)}</strong><span>Reservations shown</span></article><article><strong>{data.products.length}</strong><span>Products shown</span></article></section>
      <div className="columns"><section><p className="eyebrow">ON THE MAT</p><h2>Class schedule</h2>{data.classes.length === 0 && <p>No upcoming classes scheduled yet.</p>}{data.classes.map(item => <article className="card" key={item.id}><div><h3>{item.name}</h3><p>{item.instructor} · {item.durationMinutes} min · {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City' }).format(new Date(item.startsAt))}</p></div><span className="pill">{item.capacity - item.booked <= 0 ? 'Full' : `${item.capacity - item.booked} spots open`}</span></article>)}<p className="hint">Times shown in Mexico City time. Booking is planned.</p></section>
      <section><p className="eyebrow">AFTER THE FLOW</p><h2>From the coffee bar</h2>{data.products.length === 0 && <p>No active products yet.</p>}{data.products.map(item => <article className="card" key={item.id}><div><h3>{item.name}</h3><p>{item.category}</p></div><strong>{new Intl.NumberFormat('en', { style: 'currency', currency: item.currency, currencyDisplay: 'code' }).format(item.priceMinor / 100)}</strong></article>)}<p className="hint">Sales and inventory are planned.</p></section></div>
    </>}
    <footer>Conecta Infusion · Make space for what feels good.</footer>
  </main>;
}
