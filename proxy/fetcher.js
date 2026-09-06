const http = require('http');
const https = require('https');
const config = require('../ar.config.js');
const processor = require('./processor.js');
const headerUtils = require('../utils/headers.js');
const { sessionManager, cacheManager } = require('../core/instances.js');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

async function fetch(targetUrl, method, requestHeaders, body, session) {
    const parsed = new URL(targetUrl);
    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? https : http;
    const port = parsed.port || (isHttps ? 443 : 80);

    if (method === 'GET' && cacheManager.enabled) {
        const cacheKey = `${session.id}:GET:${targetUrl}`;
        const cached = cacheManager.get(cacheKey);
        if (cached) {
            const headers = { ...cached.headers };
            delete headers['set-cookie'];
            return { status: cached.status, headers, body: cached.body };
        }
    }

    const headers = headerUtils.buildHeaders(parsed, requestHeaders, session);

    const options = {
        hostname: parsed.hostname,
        port,
        path: parsed.pathname + parsed.search,
        method,
        headers,
        agent: isHttps ? httpsAgent : httpAgent,
        rejectUnauthorized: false,
        timeout: config.timeout * 1000
    };

    return new Promise((resolve, reject) => {
        const proxyReq = client.request(options, (proxyRes) => {
            if (proxyRes.headers['set-cookie']) {
                sessionManager.setCookies(session, parsed.hostname, proxyRes.headers['set-cookie']);
            }

            const responseHeaders = headerUtils.cleanHeaders(proxyRes.headers);

            if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
                const location = new URL(proxyRes.headers.location, targetUrl).href;
                responseHeaders['location'] = `/proxy/${encodeURIComponent(location)}?session=${session.id}`;
                responseHeaders['content-length'] = 0;
                proxyRes.resume();
                resolve({ status: proxyRes.statusCode, headers: responseHeaders, body: Buffer.alloc(0) });
                return;
            }

            const contentType = proxyRes.headers['content-type'] || '';
            const finalContentType = require('../utils/mime.js').getMimeType(contentType, targetUrl);

            if (
                finalContentType.includes('text/html') ||
                finalContentType.includes('text/css') ||
                finalContentType.includes('javascript')
            ) {
                processor.process(proxyReq, proxyRes, finalContentType, targetUrl, responseHeaders, session, method)
                    .then((result) => {
                        if (method === 'GET' && !proxyRes.headers['set-cookie']) {
                            cacheManager.set(`${session.id}:GET:${targetUrl}`, {
                                status: result.status,
                                headers: result.headers,
                                body: result.body
                            });
                        }
                        resolve(result);
                    })
                    .catch(reject);
            } else {
                responseHeaders['content-type'] = finalContentType;
                resolve({ status: proxyRes.statusCode, headers: responseHeaders, body: proxyRes });
            }
        });

        proxyReq.on('error', reject);
        if (body) proxyReq.write(body);
        proxyReq.end();
    });
}

module.exports = { fetch };