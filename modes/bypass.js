const http = require('http');
const https = require('https');
const path = require('path');
const CookieManager = require('../browser/cookies.js');
const RedirectHandler = require('../browser/redirects.js');
const HeaderBuilder = require('../utils/header_builder.js');
const Rewriter = require('../browser/rewriter.js');
const TLSSpoofer = require('../bypass/tls_spoofer.js');

class BypassMode {
    constructor(config) {
        this.config = config;
        this.timeout = config.bypass?.timeout || 30;
        this.retryAttempts = config.bypass?.retry_attempts || 5;
        this.cookieManager = new CookieManager();
        this.redirectHandler = new RedirectHandler();
        this.headerBuilder = new HeaderBuilder(config);
        this.rewriter = new Rewriter();
        this.tlsSpoofer = new TLSSpoofer();
    }
    
    async handle(request, sessionId) {
        const targetUrl = request.url || request.targetUrl;
        if (!targetUrl) return { status: 400, body: 'No target URL', headers: {} };
        
        for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
            try {
                let currentUrl = targetUrl;
                let redirectCount = 0;
                const maxRedirects = 15;
                
                while (redirectCount < maxRedirects) {
                    const response = await this.fetch(currentUrl, request, sessionId);
                    
                    if (response.status >= 300 && response.status < 400 && response.headers.location) {
                        currentUrl = this.redirectHandler.resolve(currentUrl, response.headers.location);
                        redirectCount++;
                        continue;
                    }
                    
                    return response;
                }
                
                return { status: 500, body: 'Too many redirects', headers: {} };
            } catch (e) {
                if (attempt === this.retryAttempts - 1) {
                    return { status: 502, body: 'Bad Gateway', headers: {}, error: e.message };
                }
                await this.sleep(500 * (attempt + 1));
            }
        }
    }
    
    async fetch(targetUrl, request, sessionId) {
        return new Promise((resolve, reject) => {
            const parsed = new URL(targetUrl);
            const client = parsed.protocol === 'https:' ? https : http;
            
            const headers = this.headerBuilder.build(request, parsed, sessionId);
            
            if (sessionId) {
                const cookies = this.cookieManager.getCookies(sessionId, parsed.hostname);
                if (cookies) headers['Cookie'] = cookies;
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
                
                const responseHeaders = this.cleanHeaders(res.headers, parsed);
                
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    const contentType = responseHeaders['content-type'] || '';
                    
                    let body = buffer;
                    
                    if (contentType.includes('text/html') || contentType.includes('text/css') || contentType.includes('application/javascript')) {
                        const text = buffer.toString('utf-8');
                        const rewritten = this.rewriter.rewrite(text, targetUrl, contentType);
                        body = Buffer.from(rewritten, 'utf-8');
                        responseHeaders['content-length'] = body.length;
                    }
                    
                    resolve({
                        status: res.statusCode,
                        headers: responseHeaders,
                        body: body
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
    
    cleanHeaders(headers, parsed) {
        const clean = {};
        const skipHeaders = [
            'content-security-policy',
            'x-frame-options',
            'strict-transport-security',
            'content-length',
            'transfer-encoding',
            'connection',
            'keep-alive',
            'upgrade'
        ];
        
        for (const key of Object.keys(headers)) {
            const lower = key.toLowerCase();
            if (!skipHeaders.includes(lower)) {
                clean[key] = headers[key];
            }
        }
        
        if (!clean['content-type']) {
            const ext = path.extname(parsed.pathname).toLowerCase();
            const mimeTypes = {
                '.html': 'text/html',
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.webp': 'image/webp',
                '.ico': 'image/x-icon',
                '.woff': 'font/woff',
                '.woff2': 'font/woff2',
                '.ttf': 'font/ttf',
                '.mp4': 'video/mp4',
                '.webm': 'video/webm',
                '.mp3': 'audio/mpeg'
            };
            clean['content-type'] = mimeTypes[ext] || 'application/octet-stream';
        }
        
        clean['Access-Control-Allow-Origin'] = '*';
        clean['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
        clean['Access-Control-Allow-Headers'] = '*';
        
        return clean;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = BypassMode;