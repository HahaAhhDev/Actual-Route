const http = require('http');
const https = require('https');
const path = require('path');
const zlib = require('zlib');
const CookieManager = require('../browser/cookies.js');
const HeaderBuilder = require('../utils/header_builder.js');
const Rewriter = require('../browser/rewriter.js');

const MAX_BODY_SIZE = 10 * 1024 * 1024;
const MAX_RESPONSE_SIZE = 200 * 1024 * 1024;

class BypassMode {
    constructor(config) {
        this.config = config;
        this.timeout = config.bypass?.timeout || 30;
        this.cookieManager = new CookieManager();
        this.headerBuilder = new HeaderBuilder(config);
        this.rewriter = new Rewriter();
        this.proxyPrefix = '/proxy/';
    }

    async handle(request, sessionId) {
        const targetUrl = request.url || request.targetUrl;
        if (!targetUrl) {
            return {
                status: 400,
                body: 'No target URL',
                headers: {}
            };
        }

        return await this.fetchOne(targetUrl, request, sessionId);
    }

    async fetchOne(targetUrl, request, sessionId) {
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

                const responseHeaders = this.cleanHeaders(res.headers, parsed);

                // Send redirect to browser with rewritten Location
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const absoluteLocation = this.resolveRedirect(targetUrl, res.headers.location);
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
                    try {
                        if (encoding === 'gzip') {
                            buffer = zlib.gunzipSync(buffer);
                        } else if (encoding === 'deflate') {
                            buffer = zlib.inflateSync(buffer);
                        } else if (encoding === 'br') {
                            buffer = zlib.brotliDecompressSync(buffer);
                        }
                    } catch (e) {
                        // keep original
                    }

                    delete responseHeaders['content-encoding'];

                    const contentType = responseHeaders['content-type'] || '';
                    let body = buffer;

                    if (
                        contentType.includes('text/html') ||
                        contentType.includes('text/css') ||
                        contentType.includes('javascript')
                    ) {
                        const text = buffer.toString('utf-8');
                        body = Buffer.from(
                            this.rewriter.rewrite(text, targetUrl, contentType),
                            'utf-8'
                        );
                    }

                    responseHeaders['content-length'] = body.length;

                    resolve({
                        status: res.statusCode,
                        headers: responseHeaders,
                        body: body
                    });
                });
            });

            req.on('timeout', () => req.destroy(new Error('Timeout')));
            req.on('error', reject);

            if (request.body && request.method !== 'GET' && request.method !== 'HEAD') {
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

    resolveRedirect(currentUrl, location) {
        try {
            return new URL(location, currentUrl).href;
        } catch {
            return currentUrl;
        }
    }

    cleanHeaders(headers, parsed) {
        const clean = {};
        const skip = [
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

        for (const key of Object.keys(headers || {})) {
            const lower = key.toLowerCase();
            if (!skip.includes(lower)) {
                clean[key] = headers[key];
            }
        }

        if (!clean['content-type']) {
            const ext = path.extname(parsed.pathname).toLowerCase();
            const mime = {
                '.html': 'text/html; charset=utf-8',
                '.css': 'text/css; charset=utf-8',
                '.js': 'application/javascript; charset=utf-8',
                '.json': 'application/json; charset=utf-8',
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
            clean['content-type'] = mime[ext] || 'application/octet-stream';
        }

        clean['Access-Control-Allow-Origin'] = '*';
        clean['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
        clean['Access-Control-Allow-Headers'] = '*';

        return clean;
    }
}

module.exports = BypassMode;