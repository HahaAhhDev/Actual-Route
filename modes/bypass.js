const http = require('http');
const https = require('https');
const CookieManager = require('../browser/cookies.js');
const RedirectHandler = require('../browser/redirects.js');
const HeaderBuilder = require('../utils/header_builder.js');

class BypassMode {
    constructor(config) {
        this.config = config;
        this.timeout = config.bypass?.timeout || 20;
        this.retryAttempts = config.bypass?.retry_attempts || 3;
        this.cookieManager = new CookieManager();
        this.redirectHandler = new RedirectHandler();
        this.headerBuilder = new HeaderBuilder(config);
    }
    
    async handle(request, sessionId) {
        const targetUrl = request.url || request.targetUrl;
        if (!targetUrl) return { status: 400, body: 'No target URL' };
        
        let currentUrl = targetUrl;
        let redirectCount = 0;
        const maxRedirects = 10;
        
        while (redirectCount < maxRedirects) {
            const response = await this.fetch(currentUrl, request, sessionId);
            
            if (response.status >= 300 && response.status < 400 && response.headers.location) {
                currentUrl = this.redirectHandler.resolve(currentUrl, response.headers.location);
                redirectCount++;
                continue;
            }
            
            return response;
        }
        
        return { status: 500, body: 'Too many redirects' };
    }
    
    async fetch(targetUrl, request, sessionId) {
        return new Promise((resolve, reject) => {
            const parsed = new URL(targetUrl);
            const client = parsed.protocol === 'https:' ? https : http;
            
            const headers = this.headerBuilder.build(request, parsed, sessionId);
            
            if (sessionId) {
                const cookies = this.cookieManager.getCookies(sessionId, parsed.hostname);
                if (cookies) {
                    headers['Cookie'] = cookies;
                }
            }
            
            const options = {
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                path: parsed.pathname + parsed.search,
                method: request.method || 'GET',
                headers: headers,
                timeout: this.timeout * 1000,
                rejectUnauthorized: false
            };
            
            const req = client.request(options, (res) => {
                if (sessionId && res.headers['set-cookie']) {
                    this.cookieManager.setCookies(sessionId, parsed.hostname, res.headers['set-cookie']);
                }
                
                const responseHeaders = this.cleanHeaders(res.headers);
                
                if (this.config.features?.streaming) {
                    resolve({
                        status: res.statusCode,
                        headers: responseHeaders,
                        body: res
                    });
                } else {
                    let data = [];
                    res.on('data', chunk => data.push(chunk));
                    res.on('end', () => {
                        resolve({
                            status: res.statusCode,
                            headers: responseHeaders,
                            body: Buffer.concat(data)
                        });
                    });
                }
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
    
    cleanHeaders(headers) {
        const clean = {};
        for (const key of Object.keys(headers)) {
            const lower = key.toLowerCase();
            if (lower !== 'content-security-policy' && 
                lower !== 'x-frame-options' &&
                lower !== 'strict-transport-security') {
                clean[key] = headers[key];
            }
        }
        clean['Access-Control-Allow-Origin'] = '*';
        clean['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        clean['Access-Control-Allow-Headers'] = '*';
        return clean;
    }
}

module.exports = BypassMode;