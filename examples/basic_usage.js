const ActualRoute = require('../index.js');

const ar = new ActualRoute();

console.log('[AR] Mode:', ar.getMode());

const testRequest = {
    url: 'https://example.com',
    method: 'GET',
    headers: {}
};

ar.route(testRequest, null).then(response => {
    console.log('[AR] Status:', response.status);
    console.log('[AR] Content-Type:', response.headers?.['content-type']);
    console.log('[AR] Body length:', response.body?.length || 0);
}).catch(err => {
    console.log('[AR] Error:', err.message);
});