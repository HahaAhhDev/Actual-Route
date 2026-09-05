const http = require('http');
const https = require('https');
const path = require('path');
const zlib = require('zlib');
const CookieManager = require('../browser/cookies.js');
const RedirectHandler = require('../browser/redirects.js');
const HeaderBuilder = require('../utils/header_builder.js');
const Rewriter = require('../browser/rewriter.js');
const WebSocketProxy = require('../browser/websocket.js');
const PythonBypassConnector = require('../bypass/python_connector.js');

const MAX_BODY_SIZE = 10 * 1024 * 1024;
const MAX_RESPONSE_SIZE = 50 * 1024 * 1024;

class BypassMode {
    constructor(config) {
        this.config = config;
        this.timeout = config.bypass?.timeout || 30;
        this.retryAttempts = config.bypass?.retry_attempts || 5;
        this.cookieManager = new CookieManager();
        this.redirectHandler = new RedirectHandler();
        this.headerBuilder = new HeaderBuilder(config);
        this.rewriter = new Rewriter();
        this.webSocketProxy = new WebSocketProxy();
        this.pythonConnector = new PythonBypassConnector();
        this.proxyPrefix = '/proxy/';
    }
    
    async handle(request, sessionId) {
        const targetUrl = request.url || request.targetUrl;
        if (!targetUrl) return { status: 400, body: 'No target URL', headers: {}, isWebSocket: false };
        
        if (request.headers && request.headers.upgrade && request.headers.upgrade.toLowerCase() === 'websocket') {
            const ws = await this.handleWebSocket(targetUrl);
            return { status: 101, headers: { 'Upgrade': 'websocket', 'Connection': 'Upgrade' }, isWebSocket: true, websocket: ws };
        }
        
        if (this.config.bypass?.cloudflare) {
            try {
                const pythonResponse = await this.pythonConnector.fetch(
                    targetUrl,
                    request.method || 'GET',
                    request.headers || {},
                    request.body ? Buffer.from(request.body).toString('base64') : null
                );
                
                if (pythonResponse && pythonResponse.stream) {
                    return {
                        status: pythonResponse.status,
                        headers: this.cleanHeaders(pythonResponse.headers || {}, new URL(targetUrl)),
                        body: pythonResponse.stream,
                        isWebSocket: false
                    };
                }
            } catch (e) {}
        }
        
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
                    
                    return { ...response, isWebSocket: false };
                }
                
                return { status: 500, body: 'Too many redirects', headers: {}, isWebSocket: false };
            } catch (e) {
                if (attempt === this.retryAttempts - 1) {
                    return { status: 502, body: 'Bad Gateway', headers: {}, isWebSocket: false, error: e.message };
                }
                await this.sleep(500 * (attempt + 1));
            }
        }
    }
    
    async handleWebSocket(targetUrl) {
        try {
            return await this.webSocketProxy.handle(null, targetUrl);
        } catch (e) {
            return null;
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
                
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const absoluteLocation = this.redirectHandler.resolve(targetUrl, res.headers.location);
                    responseHeaders['location'] = `${this.proxyPrefix}${encodeURIComponent(absoluteLocation)}`;
                    
                    res.resume();
                    resolve({
                        status: res.statusCode,
                        headers: responseHeaders,
                        body: Buffer.alloc(0)
                    });
                    return;
                }
                
                const chunks = [];
                let totalSize = 0;
                
                res.on('data', (chunk) => {
                    totalSize += chunk.length;
                    if (totalSize > MAX_RESPONSE_SIZE) {
                        req.destroy(new Error('Response too large'));
                        reject(new Error('Response too large'));
                        return;
                    }
                    chunks.push(chunk);
                });
                
                res.on('end', () => {
                    let buffer = Buffer.concat(chunks);
                    
                    const encoding = res.headers['content-encoding'];
                    if (encoding === 'gzip') {
                        try { buffer = zlib.gunzipSync(buffer); } catch (e) {}
                    } else if (encoding === 'deflate') {
                        try { buffer = zlib.inflateSync(buffer); } catch (e) {}
                    } else if (encoding === 'br') {
                        try { buffer = zlib.brotliDecompressSync(buffer); } catch (e) {}
                    }
                    
                    delete responseHeaders['content-encoding'];
                    
                    const contentType = responseHeaders['content-type'] || '';
                    
                    let body = buffer;
                    
                    if (contentType.includes('text/html') || contentType.includes('text/css') || contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
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
                let bodyData;
                if (typeof request.body === 'string') {
                    bodyData = Buffer.from(request.body);
                } else if (Buffer.isBuffer(request.body)) {
                    bodyData = request.body;
                } else {
                    bodyData = Buffer.from(JSON.stringify(request.body));
                }
                
                if (bodyData.length > MAX_BODY_SIZE) {
                    reject(new Error('Body too large'));
                    return;
                }
                
                req.write(bodyData);
            }
            req.end();
        });
    }
    
    cleanHeaders(headers, parsed) {
        const clean = {};
        const skipHeaders = [
            'content-security-policy', 'x-frame-options', 'strict-transport-security',
            'content-length', 'transfer-encoding', 'connection', 'keep-alive', 'upgrade',
            'content-encoding'
        ];
        
        for (const key of Object.keys(headers || {})) {
            const lower = key.toLowerCase();
            if (!skipHeaders.includes(lower)) {
                clean[key] = headers[key];
            }
        }
        
        if (!clean['content-type']) {
            const ext = path.extname(parsed.pathname).toLowerCase();
            const mimeTypes = {
                '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
                '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
                '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
                '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
                '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg'
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