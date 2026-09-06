const http = require('http');
const config = require('./ar.config.js');
const router = require('./router.js');
const websocket = require('./websocket/handler.js');
const { sessionManager } = require('./core/instances.js');

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith('/proxy/')) {
        await router.handle(req, res, url);
    } else if (url.pathname === '/api/session' && req.method === 'POST') {
        const session = sessionManager.createSession();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sessionId: session.id }));
    } else if (url.pathname.startsWith('/api/session/') && req.method === 'DELETE') {
        const sessionId = url.pathname.split('/').pop();
        sessionManager.deleteSession(sessionId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

websocket.attach(server);

server.listen(config.port, config.host, () => {
    console.log(`Actual Route running on http://${config.host}:${config.port}`);
});