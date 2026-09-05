const ActualRoute = require('../index.js');

const ar = new ActualRoute('./custom.config.js');

console.log('[AR] Mode:', ar.getMode());
console.log('[AR] Features:', JSON.stringify(ar.getFeatures(), null, 2));