const WebSocket = require('ws');

class WebSocketProxy {
    constructor() {
        this.connections = new Map();
    }
    
    async handle(serverRequest, targetUrl) {
        const parsed = new URL(targetUrl);
        const wsUrl = `ws://${parsed.hostname}:${parsed.port || (parsed.protocol === 'https:' ? 443 : 80)}${parsed.pathname}${parsed.search}`;
        
        const targetWs = new WebSocket(wsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Origin': parsed.origin
            }
        });
        
        return new Promise((resolve, reject) => {
            targetWs.on('open', () => {
                const connection = {
                    targetWs,
                    lastPing: Date.now(),
                    pingInterval: null
                };
                
                connection.pingInterval = setInterval(() => {
                    if (targetWs.readyState === WebSocket.OPEN) {
                        targetWs.ping();
                        connection.lastPing = Date.now();
                    }
                }, 30000);
                
                this.connections.set(targetUrl, connection);
                
                resolve({
                    send: (data) => {
                        if (targetWs.readyState === WebSocket.OPEN) {
                            targetWs.send(data);
                        }
                    },
                    onMessage: (callback) => {
                        targetWs.on('message', callback);
                    },
                    onClose: (callback) => {
                        targetWs.on('close', callback);
                    },
                    close: () => {
                        if (connection.pingInterval) {
                            clearInterval(connection.pingInterval);
                        }
                        targetWs.close();
                        this.connections.delete(targetUrl);
                    }
                });
            });
            
            targetWs.on('error', reject);
        });
    }
}

module.exports = WebSocketProxy;