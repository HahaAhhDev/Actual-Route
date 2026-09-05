const http = require('http');
const https = require('https');

class BypassMode {
    constructor(config) {
        this.config = config;
        this.timeout = config.bypass?.timeout || 20;
        this.retryAttempts = config.bypass?.retry_attempts || 2;
    }
    
    async handle(request, sessionId) {
        const targetUrl = request.url || request.targetUrl;
        if (!targetUrl) {
            return { status: 400, body: 'No target URL' };
        }
        
        for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
            try {
                return await this.fetch(targetUrl, request, sessionId);
            } catch (e) {
                if (attempt === this.retryAttempts - 1) throw e;
                await this.sleep(500 * (attempt + 1));
            }
        }
    }
    
    async fetch(targetUrl, request, sessionId) {
        return new Promise((resolve, reject) => {
            const parsed = new URL(targetUrl);
            const client = parsed.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                path: parsed.pathname + parsed.search,
                method: request.method || 'GET',
                headers: this.buildHeaders(request, parsed, sessionId),
                timeout: this.timeout * 1000,
                rejectUnauthorized: false
            };
            
            const req = client.request(options, (res) => {
                let data = [];
                res.on('data', chunk => data.push(chunk));
                res.on('end', () => {
                    const responseHeaders = this.cleanResponseHeaders(res.headers);
                    resolve({
                        status: res.statusCode,
                        headers: responseHeaders,
                        body: Buffer.concat(data)
                    });
                });
            });
            
            req.on('timeout', () => req.destroy(new Error('Timeout')));
            req.on('error', reject);
            
            if (request.body && typeof request.body.pipe === 'function') {
                request.body.pipe(req);
            } else if (request.body) {
                req.write(request.body);
                req.end();
            } else {
                req.end();
            }
        });
    }
    
    buildHeaders(request, parsed, sessionId) {
        const headers = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
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
        
        if (request.headers) {
            for (const key of Object.keys(request.headers)) {
                const lowerKey = key.toLowerCase();
                if (!this.isProxyHeader(lowerKey)) {
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
            'x-forwarded-for',
            'x-forwarded-host',
            'x-forwarded-proto',
            'forwarded',
            'via',
            'x-real-ip',
            'connection',
            'proxy-connection',
            'keep-alive',
            'transfer-encoding',
            'upgrade',
            'expect'
        ];
        return proxyHeaders.includes(header);
    }
    
    cleanResponseHeaders(headers) {
        const clean = {};
        
        for (const key of Object.keys(headers)) {
            const lowerKey = key.toLowerCase();
            if (lowerKey !== 'content-security-policy' && 
                lowerKey !== 'x-frame-options' &&
                lowerKey !== 'strict-transport-security') {
                clean[key] = headers[key];
            }
        }
        
        clean['Access-Control-Allow-Origin'] = '*';
        clean['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        clean['Access-Control-Allow-Headers'] = '*';
        
        return clean;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = BypassMode;