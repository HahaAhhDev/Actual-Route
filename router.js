const config = require('./ar.config.js');
const fetcher = require('./proxy/fetcher.js');
const { sessionManager } = require('./core/instances.js');

async function handle(req, res, url) {
    const targetUrl = decodeURIComponent(url.pathname.replace('/proxy/', ''));
    const sessionId = url.searchParams.get('session') || req.headers['x-session-id'] || 'default';

    let session = sessionManager.getSession(sessionId);
    if (!session) {
        session = sessionManager.createSession();
    }

    let body = '';
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        body = await readBody(req);
    }

    try {
        const result = await fetcher.fetch(targetUrl, req.method, req.headers, body, session);
        res.writeHead(result.status, result.headers);
        if (result.body && typeof result.body.pipe === 'function') {
            result.body.pipe(res);
        } else {
            res.end(result.body);
        }
    } catch (e) {
        console.error('Proxy error:', e);
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Bad Gateway: ' + e.message);
    }
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        let size = 0;
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > config.maxBodySize) {
                reject(new Error('Body too large'));
                req.destroy();
                return;
            }
            data += chunk;
        });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}

module.exports = { handle, sessionManager };