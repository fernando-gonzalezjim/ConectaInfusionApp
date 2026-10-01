import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateSettings } from '../dist/modules/foundation/validation.js';
const valid = { displayName: 'Conecta Infusion', country: 'MX', currency: 'MXN', timezone: 'America/Mexico_City', defaultLocale: 'es-MX', supportedLocales: ['es-MX', 'en'], defaultCapacity: 16 };
test('accepts supported settings and trims the name', () => {
  assert.deepEqual(validateSettings({ ...valid, displayName: '  Conecta Infusion ' }), valid);
});
test('rejects invalid capacity, unsupported currency, unknown fields and timezone', () => {
  for (const patch of [{ defaultCapacity: 0 }, { defaultCapacity: 1.5 }, { defaultCapacity: 2147483648 }, { currency: 'USD' }, { timezone: 'Invalid' }, { password: 'secret' }, { displayName: '' }]) {
    assert.throws(() => validateSettings({ ...valid, ...patch }), /INVALID_SETTINGS/);
  }
});
