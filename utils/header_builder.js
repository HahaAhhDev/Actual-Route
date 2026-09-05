class HeaderBuilder {
    constructor(config) {
        this.config = config;
    }
    
    build(request, parsed, sessionId) {
        const headers = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        };
        
        if (this.config.features?.tls_spoofing) {
            headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        }
        
        if (request.headers) {
            for (const key of Object.keys(request.headers)) {
                const lower = key.toLowerCase();
                if (!this.isProxyHeader(lower)) {
                    headers[key] = request.headers[key];
                }
            }
        }
        
        headers['Host'] = parsed.hostname;
        
        if (sessionId) {
            headers['X-Session-Id'] = sessionId;
        }
        
        return headers;
    }
    
    isProxyHeader(header) {
        const proxyHeaders = [
            'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto',
            'forwarded', 'via', 'x-real-ip', 'connection',
            'proxy-connection', 'keep-alive', 'transfer-encoding',
            'upgrade', 'expect'
        ];
        return proxyHeaders.includes(header);
    }
}

module.exports = HeaderBuilder;