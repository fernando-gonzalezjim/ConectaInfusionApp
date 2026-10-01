import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, formatBusinessTime, readLocale, saveLocale } from '../src/format.ts';
test('money uses minor units and does not change with language', () => {
  for (const locale of ['es-MX','en']) assert.match(formatMoney(15000,'MXN',locale), /150\.00/);
});
test('time is displayed in the business timezone', () => {
  assert.match(formatBusinessTime('2026-10-01T18:00:00Z','en','America/Mexico_City'), /12:00/);
});
test('locale storage handles missing, invalid and blocked storage', () => {
  assert.equal(readLocale({ getItem: () => null }), 'es-MX');
  assert.equal(readLocale({ getItem: () => 'fr' }), 'es-MX');
  assert.equal(readLocale({ getItem: () => 'en' }), 'en');
  assert.equal(readLocale({ getItem: () => { throw new Error(); } }), 'es-MX');
  assert.doesNotThrow(() => saveLocale('en', { setItem: () => { throw new Error(); } }));
});
