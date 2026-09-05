const ActualRoute = require('../index.js');

const ar = new ActualRoute();

console.log('[AR] Mode:', ar.getMode());
console.log('[AR] Features:', ar.getFeatures());

const testRequest = {
    url: 'https://example.com',
    method: 'GET',
    headers: { 'User-Agent': 'test' }
};

ar.route(testRequest, null).then(response => {
    console.log('[AR] Status:', response.status);
    console.log('[AR] Response length:', response.body?.length || 0);
}).catch(err => {
    console.log('[AR] Error:', err.message);
});