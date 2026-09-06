const WebSocket = require('ws');

const wss = new WebSocket.Server({ noServer: true });

function attach(server) {
    server.on('upgrade', (req, socket, head) => {
        const url = new URL(req.url, 'http://localhost');

        if (url.pathname.startsWith('/ws/')) {
            wss.handleUpgrade(req, socket, head, (clientWs) => {
                handleConnection(clientWs, url);
            });
        } else {
            socket.destroy();
        }
    });
}

function handleConnection(clientWs, url) {
    const targetUrl = decodeURIComponent(url.pathname.replace('/ws/', ''));

    let parsed;
    try {
        parsed = new URL(targetUrl);
    } catch (e) {
        clientWs.close();
        return;
    }

    const wsUrl = `ws://${parsed.hostname}:${parsed.port || 80}${parsed.pathname}${parsed.search}`;

    const targetWs = new WebSocket(wsUrl, {
        headers: {
            'Origin': `${parsed.protocol}//${parsed.host}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    targetWs.on('open', () => {
        clientWs.on('message', (data) => {
            if (targetWs.readyState === WebSocket.OPEN) targetWs.send(data);
        });
    });

    targetWs.on('message', (data) => {
        if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data);
    });

    clientWs.on('close', () => targetWs.close());
    targetWs.on('close', () => clientWs.close());
    targetWs.on('error', () => clientWs.close());
    clientWs.on('error', () => targetWs.close());
}

module.exports = { attach };