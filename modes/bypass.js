const http = require('http');
const https = require('https');
const zlib = require('zlib');

class BypassMode {
    constructor(config) {
        this.config = config;
        this.timeout = config.bypass?.timeout || 30;
        this.connectionPool = new Map();
        this.maxPoolSize = 50;
    }

    getConnection(protocol, hostname, port) {
        const key = `${protocol}:${hostname}:${port}`;
        
        if (this.connectionPool.has(key)) {
            const pool = this.connectionPool.get(key);
            const conn = pool.pop();
            if (conn && !conn.destroyed) {
                return conn;
            }
        }
        
        return null;
    }

    storeConnection(protocol, hostname, port, conn) {
        const key = `${protocol}:${hostname}:${port}`;
        
        if (!this.connectionPool.has(key)) {
            this.connectionPool.set(key, []);
        }
        
        const pool = this.connectionPool.get(key);
        
        if (pool.length < this.maxPoolSize) {
            pool.push(conn);
        } else {
            conn.destroy();
        }
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
            const protocol = parsed.protocol === 'https:' ? 'https' : 'http';
            const port = parsed.port || (parsed.protocol === 'https:' ? 443 : 80);

            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'identity',
                'Host': parsed.hostname
            };

            if (request.headers) {
                if (request.headers['cookie']) headers['Cookie'] = request.headers['cookie'];
                if (request.headers['content-type']) headers['Content-Type'] = request.headers['content-type'];
                if (request.headers['accept']) headers['Accept'] = request.headers['accept'];
                if (request.headers['range']) headers['Range'] = request.headers['range'];
            }

            const options = {
                hostname: parsed.hostname,
                port: port,
                path: parsed.pathname + parsed.search,
                method: request.method || 'GET',
                headers: headers,
                timeout: this.timeout * 1000,
                rejectUnauthorized: false
            };

            const client = protocol === 'https' ? https : http;

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

                responseHeaders['access-control-allow-origin'] = '*';

                // Send redirects to browser
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const location = new URL(res.headers.location, targetUrl).href;
                    responseHeaders['location'] = `/proxy/${encodeURIComponent(location)}`;
                    responseHeaders['content-length'] = 0;
                    res.resume();
                    resolve({
                        status: res.statusCode,
                        headers: responseHeaders,
                        body: Buffer.alloc(0)
                    });
                    return;
                }

                const contentType = res.headers['content-type'] || '';
                const isHtml = contentType.includes('text/html');

                if (isHtml) {
                    // Buffer HTML for rewriting
                    const chunks = [];
                    let totalSize = 0;

                    res.on('data', (chunk) => {
                        totalSize += chunk.length;
                        if (totalSize > 50 * 1024 * 1024) {
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

                        let html = buffer.toString('utf-8');

                        // Rewrite URLs
                        html = html.replace(/\bsrc\s*=\s*(["'])(.*?)\1/gi, (m, q, url) => {
                            if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('blob:') || url.startsWith('/proxy/')) return m;
                            const full = new URL(url, targetUrl).href;
                            return `src=${q}/proxy/${encodeURIComponent(full)}${q}`;
                        });

                        html = html.replace(/\bhref\s*=\s*(["'])(.*?)\1/gi, (m, q, url) => {
                            if (url.startsWith('javascript:') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('data:') || url.startsWith('/proxy/')) return m;
                            const full = new URL(url, targetUrl).href;
                            return `href=${q}/proxy/${encodeURIComponent(full)}${q}`;
                        });

                        html = html.replace(/\baction\s*=\s*(["'])(.*?)\1/gi, (m, q, url) => {
                            if (url.startsWith('#') || url.startsWith('/proxy/')) return m;
                            const full = new URL(url, targetUrl).href;
                            return `action=${q}/proxy/${encodeURIComponent(full)}${q}`;
                        });

                        html = html.replace(/url\((['"]?)(.*?)\1\)/gi, (m, q, url) => {
                            if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('blob:') || url.startsWith('/proxy/')) return m;
                            const full = new URL(url, targetUrl).href;
                            return `url(${q}/proxy/${encodeURIComponent(full)}${q})`;
                        });

                        // Rewrite inline scripts
                        html = html.replace(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi, (match, code) => {
                            let rewritten = code;
                            rewritten = rewritten.replace(/window\.location(?:\.href)?\s*=\s*["'](.*?)["']/gi, (m2, url) => {
                                if (url.startsWith('/proxy/') || url.startsWith('javascript:') || url.startsWith('#')) return m2;
                                const full = new URL(url, targetUrl).href;
                                return `window.location.href="/proxy/${encodeURIComponent(full)}"`;
                            });
                            rewritten = rewritten.replace(/location\.href\s*=\s*["'](.*?)["']/gi, (m2, url) => {
                                if (url.startsWith('/proxy/') || url.startsWith('javascript:') || url.startsWith('#')) return m2;
                                const full = new URL(url, targetUrl).href;
                                return `location.href="/proxy/${encodeURIComponent(full)}"`;
                            });
                            return match.replace(code, rewritten);
                        });

                        // Inject form handler
                        const formHandler = `
<script>
(function() {
    document.addEventListener('submit', function(e) {
        var form = e.target;
        if (!form || form.tagName !== 'FORM') return;
        e.preventDefault();
        e.stopPropagation();
        var query = '';
        var inputs = form.querySelectorAll('input[name="q"], input[type="text"], input[type="search"]');
        for (var i = 0; i < inputs.length; i++) {
            if (inputs[i].value) {
                query = inputs[i].value;
                break;
            }
        }
        if (!query) return;
        var searchUrl = 'https://duckduckgo.com/?q=' + encodeURIComponent(query);
        window.location.href = '/proxy/' + encodeURIComponent(searchUrl);
    }, true);
})();
</script>`;

                        if (html.includes('</body>')) {
                            html = html.replace('</body>', formHandler + '</body>');
                        } else {
                            html += formHandler;
                        }

                        buffer = Buffer.from(html, 'utf-8');
                        responseHeaders['content-length'] = buffer.length;

                        resolve({
                            status: res.statusCode,
                            headers: responseHeaders,
                            body: buffer
                        });
                    });
                } else {
                    // Stream binary content directly
                    resolve({
                        status: res.statusCode,
                        headers: responseHeaders,
                        body: res
                    });
                }
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