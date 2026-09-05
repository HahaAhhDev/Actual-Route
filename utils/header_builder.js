const TLSSpoofer = require('../bypass/tls_spoofer.js');

class HeaderBuilder {
    constructor(config) {
        this.config = config;
        this.tlsSpoofer = new TLSSpoofer();
    }
    
    build(request, parsed, sessionId) {
        let headers = {};
        
        if (this.config.features?.tls_spoofing || this.config.bypass?.tls_spoofing) {
            headers = this.tlsSpoofer.getHeaders('chrome120');
        }
        
        if (request && request.headers) {
            const allowed = ['authorization','content-type','referer','origin','range','cookie','x-requested-with','x-csrf-token'];
            for (const key of Object.keys(request.headers)) {
                const lower = key.toLowerCase();
                if (allowed.includes(lower)) headers[key] = request.headers[key];
            }
        }
        
        headers['Host'] = parsed.hostname;
        headers['Accept-Encoding'] = 'identity';
        
        if (sessionId) headers['X-Session-Id'] = sessionId;
        
        return headers;
    }
}

module.exports = HeaderBuilder;