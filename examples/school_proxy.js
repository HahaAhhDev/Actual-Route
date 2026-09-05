const ActualRoute = require('../index.js');

const schoolConfig = {
    mode: 'school',
    features: {
        caching: true,
        sessions: true,
        tls_spoofing: true,
        cloudflare_bypass: false
    }
};

const ar = new ActualRoute(null);
ar.config = { ...ar.config, ...schoolConfig };

console.log('[School Proxy] Mode:', ar.getMode());
console.log('[School Proxy] Ready');