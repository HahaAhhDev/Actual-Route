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
                headers: this.buildHeaders(request, sessionId),
                timeout: this.timeout * 1000
            };
            
            const req = client.request(options, (res) => {
                let data = [];
                res.on('data', chunk => data.push(chunk));
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: Buffer.concat(data)
                    });
                });
            });
            
            req.on('timeout', () => req.destroy(new Error('Timeout')));
            req.on('error', reject);
            
            if (request.body) {
                req.write(request.body);
            }
            
            req.end();
        });
    }
    
    buildHeaders(request, sessionId) {
        const headers = { ...request.headers };
        
        if (this.config.features?.tls_spoofing) {
            headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        }
        
        if (sessionId) {
            headers['X-Session-Id'] = sessionId;
        }
        
        delete headers['host'];
        delete headers['connection'];
        
        return headers;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = BypassMode;