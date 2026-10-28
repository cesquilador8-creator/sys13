const assert = require('assert');
const fs = require('fs');
const path = require('path');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'dashboard', 'app.js'), 'utf8');
const sessionMatch = appSource.match(/function getCurrentSessionUser\(\) \{[\s\S]*?\n\}/m);
const helperMatch = appSource.match(/function resolveActiveAccountEmail\(\) \{[\s\S]*?\n\}/m);

assert.ok(sessionMatch, 'getCurrentSessionUser helper is missing.');
assert.ok(helperMatch, 'resolveActiveAccountEmail helper is missing.');

const sessionSource = sessionMatch[0];
const helperSource = helperMatch[0];

const localStorageFactory = (sessionValue = null, statePasswords = {}) => ({
  store: {
    ...(sessionValue ? { 'site-blocker-admin-session': JSON.stringify(sessionValue) } : {}),
  },
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  },
  setItem(key, value) {
    this.store[key] = String(value);
  },
  removeItem(key) {
    delete this.store[key];
  },
  statePasswords,
});

const scenarios = [
  {
    name: 'prefers active session email',
    state: { security: { accountPasswords: { 'admin@sys13.com': 'admin123' } } },
    localStorage: localStorageFactory({ email: 'admin@sys13.com', role: 'Administrator' }),
    expected: 'admin@sys13.com',
  },
  {
    name: 'falls back to default admin account when session is empty',
    state: { security: { accountPasswords: { 'admin@sys13.com': 'admin123' } } },
    localStorage: localStorageFactory(null),
    expected: 'admin@sys13.com',
  },
  {
    name: 'returns empty string when no active account exists',
    state: { security: { accountPasswords: {} } },
    localStorage: localStorageFactory(null),
    expected: '',
  },
];

for (const scenario of scenarios) {
  const localStorage = scenario.localStorage;
  const state = scenario.state;

  const vmContext = {
    state,
    localStorage,
    console,
  };

  const vm = require('vm');
  vm.runInNewContext(`
    ${sessionSource}
    ${helperSource}
  `, vmContext);

  const actual = vm.runInNewContext('resolveActiveAccountEmail()', vmContext);
  assert.strictEqual(actual, scenario.expected, `${scenario.name} failed: expected ${scenario.expected}, got ${actual}`);
}

console.log('Security account resolution checks passed.');
