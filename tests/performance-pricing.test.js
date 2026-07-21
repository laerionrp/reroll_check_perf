const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadPricingHelper(filePath) {
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(filePath, 'utf8'), context);
  return context.calculatePerformancePrice;
}

const frontendPrice = loadPricingHelper(
  'work/frontend/reroll_check_perf/js/performance-pricing.js'
);
const backendPrice = loadPricingHelper(
  'work/backend/reroll_check_perf_backend_current/Utils.gs'
);

const cases = [
  ['Speeder — Turbo', 60000, 0.16, 0.14, 10945],
  ['Indiana Rancher — Blindage niveau 1', 42000, 0.03, 0.14, 1437],
  ['Indiana Rancher — Blindage niveau 2 cumulé', 42000, 0.07, 0.14, 3353]
];

for (const [label, priceHT, coefficient, tva, expected] of cases) {
  assert.equal(frontendPrice(priceHT, coefficient, tva), expected, label + ' (frontend)');
  assert.equal(backendPrice(priceHT, coefficient, tva), expected, label + ' (backend)');
}

console.log('3 cas de référence validés côté frontend et backend.');
