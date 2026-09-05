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
            headers = {};
        }
        
        this.mergeCustomHeaders(headers, request.headers);
        
        headers['Host'] = parsed.hostname;
        
        if (sessionId) {
            headers['X-Session-Id'] = sessionId;
        }
        
        this.stripProxyHeaders(headers);
        
        return headers;
    }
    
    mergeCustomHeaders(headers, customHeaders) {
        if (!customHeaders) return;
        
        const allowedHeaders = [
            'authorization',
            'content-type',
            'x-requested-with',
            'x-csrf-token',
            'referer',
            'origin',
            'range',
            'if-modified-since',
            'if-none-match',
            'cookie',
            'accept',
            'accept-language',
            'accept-encoding',
            'user-agent',
            'sec-ch-ua',
            'sec-ch-ua-mobile',
            'sec-ch-ua-platform',
            'sec-fetch-dest',
            'sec-fetch-mode',
            'sec-fetch-site',
            'sec-fetch-user',
            'upgrade-insecure-requests',
            'cache-control',
            'pragma',
            'dnt',
            'sec-websocket-key',
            'sec-websocket-version',
            'sec-websocket-extensions',
            'sec-websocket-protocol'
        ];
        
        for (const key of Object.keys(customHeaders)) {
            const lower = key.toLowerCase();
            if (allowedHeaders.includes(lower)) {
                headers[key] = customHeaders[key];
            }
        }
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
            'content-length',
            'host'
        ];
        
        for (const key of Object.keys(headers)) {
            if (proxyHeaders.includes(key.toLowerCase())) {
                delete headers[key];
            }
        }
    }
}

module.exports = HeaderBuilder;