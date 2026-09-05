const ActualRoute = require('../index.js');

const ar = new ActualRoute();

console.log('[School Proxy] Mode:', ar.getMode());
console.log('[School Proxy] Features:', Object.keys(ar.getFeatures()).filter(k => ar.getFeatures()[k]).join(', '));

const testRequest = {
    url: 'https://example.com',
    method: 'GET',
    headers: {}
};

ar.route(testRequest, null).then(response => {
    console.log('[School Proxy] Status:', response.status);
    console.log('[School Proxy] Content-Type:', response.headers?.['content-type']);
    console.log('[School Proxy] Body length:', response.body?.length || 0);
}).catch(err => {
    console.log('[School Proxy] Error:', err.message);
});
