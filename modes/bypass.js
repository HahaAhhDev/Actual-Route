const http = require('http');
const https = require('https');
const zlib = require('zlib');
const path = require('path');

class BypassMode {
    constructor(config) {
        this.config = config;
        this.timeout = config.bypass?.timeout || 30;
    }

    async handle(request, sessionId) {
        const targetUrl = request.url || request.targetUrl;
        
        if (!targetUrl) {
            return { status: 400, body: 'No URL', headers: {} };
        }

        return await this.fetch(targetUrl, request);
    }

    async fetch(targetUrl, request) {
        return new Promise((resolve, reject) => {
            const parsed = new URL(targetUrl);
            const client = parsed.protocol === 'https:' ? https : http;

            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'identity',
                'Host': parsed.hostname
            };

            if (request.headers) {
                if (request.headers['cookie']) headers['Cookie'] = request.headers['cookie'];
                if (request.headers['content-type']) headers['Content-Type'] = request.headers['content-type'];
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
                const responseHeaders = {};
                const skipHeaders = [
                    'content-security-policy',
                    'x-frame-options',
                    'strict-transport-security',
                    'content-length',
                    'transfer-encoding',
                    'connection',
                    'keep-alive',
                    'upgrade',
                    'content-encoding',
                    'set-cookie'
                ];

                for (const key of Object.keys(res.headers)) {
                    const lower = key.toLowerCase();
                    if (!skipHeaders.includes(lower)) {
                        responseHeaders[key] = res.headers[key];
                    }
                }

                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const location = new URL(res.headers.location, targetUrl).href;
                    responseHeaders['location'] = `/proxy/${encodeURIComponent(location)}`;
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
                    if (totalSize > 100 * 1024 * 1024) {
                        req.destroy();
                        reject(new Error('Too large'));
                        return;
                    }
                    chunks.push(chunk);
                });

                res.on('end', () => {
                    let buffer = Buffer.concat(chunks);

                    const encoding = res.headers['content-encoding'];
                    try {
                        if (encoding === 'gzip') buffer = zlib.gunzipSync(buffer);
                        else if (encoding === 'deflate') buffer = zlib.inflateSync(buffer);
                        else if (encoding === 'br') buffer = zlib.brotliDecompressSync(buffer);
                    } catch (e) {}

                    const contentType = res.headers['content-type'] || '';

                    if (contentType.includes('text/html')) {
                        let html = buffer.toString('utf-8');
                        
                        html = html.replace(/\bsrc\s*=\s*(["'])(.*?)\1/gi, (m, q, url) => {
                            if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('blob:') || url.startsWith('/proxy/')) return m;
                            const full = new URL(url, targetUrl).href;
                            return `src=${q}/proxy/${encodeURIComponent(full)}${q}`;
                        });

                        html = html.replace(/\bhref\s*=\s*(["'])(.*?)\1/gi, (m, q, url) => {
                            if (url.startsWith('javascript:') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('data:') || url.startsWith('/proxy/')) return m;
                            const full = new URL(url, targetUrl).href;
                            return `href=${q}/proxy/${encodeURIComponent(full)}${q}`;
                        });

                        html = html.replace(/\baction\s*=\s*(["'])(.*?)\1/gi, (m, q, url) => {
                            if (url.startsWith('#') || url.startsWith('/proxy/')) return m;
                            const full = new URL(url, targetUrl).href;
                            return `action=${q}/proxy/${encodeURIComponent(full)}${q}`;
                        });

                        buffer = Buffer.from(html, 'utf-8');
                    }

                    responseHeaders['content-length'] = buffer.length;
                    responseHeaders['access-control-allow-origin'] = '*';

                    resolve({
                        status: res.statusCode,
                        headers: responseHeaders,
                        body: buffer
                    });
                });
            });

            req.on('timeout', () => req.destroy(new Error('Timeout')));
            req.on('error', reject);

            if (request.body && request.method !== 'GET') {
                req.write(request.body);
            }
            
            req.end();
        });
    }
}

module.exports = BypassMode;