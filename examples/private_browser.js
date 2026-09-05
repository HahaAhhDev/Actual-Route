const ActualRoute = require('../index.js');

const privateConfig = {
    mode: 'private',
    features: {
        caching: false,
        history: false,
        tls_spoofing: true,
        onion_routing: true
    }
};

const ar = new ActualRoute(null);
ar.config = { ...ar.config, ...privateConfig };

console.log('[Private Browser] Mode:', ar.getMode());
console.log('[Private Browser] Ready');