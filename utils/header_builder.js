const TLSSpoofer = require('../bypass/tls_spoofer.js');

class HeaderBuilder {
    constructor(config) {
        this.config = config;
        this.tlsSpoofer = new TLSSpoofer();
    }
    
    build(request, parsed, sessionId) {
        let headers;
        
        if (this.config.features?.tls_spoofing || this.config.bypass?.tls_spoofing) {
            headers = this.tlsSpoofer.getHeaders('chrome120');
        } else {
            headers = {
                'User-Agent': request.headers?.['user-agent'] || 'Mozilla/5.0',
                'Accept': request.headers?.accept || '*/*',
                'Accept-Language': request.headers?.['accept-language'] || 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br'
            };
        }
        
        headers['Host'] = parsed.hostname;
        
        if (sessionId) {
            headers['X-Session-Id'] = sessionId;
        }
        
        this.stripProxyHeaders(headers);
        
        return headers;
    }
    
    stripProxyHeaders(headers) {
        const proxyHeaders = [
            'x-forwarded-for',
            'x-forwarded-host',
            'x-forwarded-proto',
            'forwarded',
            'via',
            'x-real-ip',
            'x-client-ip',
            'client-ip',
            'x-cluster-client-ip',
            'x-originating-ip',
            'true-client-ip',
            'connection',
            'proxy-connection',
            'keep-alive',
            'transfer-encoding',
            'upgrade',
            'expect',
            'content-length'
        ];
        
        for (const header of proxyHeaders) {
            delete headers[header];
        }
        
        for (const key of Object.keys(headers)) {
            if (proxyHeaders.includes(key.toLowerCase())) {
                delete headers[key];
            }
        }
    }
}

module.exports = HeaderBuilder;