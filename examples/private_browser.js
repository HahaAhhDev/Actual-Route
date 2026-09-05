const ActualRoute = require('../index.js');

const ar = new ActualRoute();

console.log('[Private Browser] Mode:', ar.getMode());
console.log('[Private Browser] Features:', Object.keys(ar.getFeatures()).filter(k => ar.getFeatures()[k]).join(', '));

const testRequest = {
    url: 'https://example.com',
    method: 'GET',
    headers: {}
};

ar.route(testRequest, null).then(response => {
    console.log('[Private Browser] Status:', response.status);
    console.log('[Private Browser] Body length:', response.body?.length || 0);
}).catch(err => {
    console.log('[Private Browser] Error:', err.message);
});
