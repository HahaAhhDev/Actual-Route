const ActualRoute = require('../index.js');

const customConfig = {
    mode: 'custom',
    features: {
        caching: false,
        sessions: false,
        tls_spoofing: false,
        cloudflare_bypass: false
    }
};

const ar = new ActualRoute(null);
ar.config = { ...ar.config, ...customConfig };

console.log('[AR] Mode:', ar.getMode());

const testRequest = {
    url: 'https://example.com',
    method: 'GET',
    headers: {}
};

ar.route(testRequest, null).then(response => {
    console.log('[AR] Status:', response.status);
}).catch(err => {
    console.log('[AR] Error:', err.message);
});