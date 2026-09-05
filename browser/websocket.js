const { EventEmitter } = require('events');

class WebSocketProxy extends EventEmitter {
    constructor() {
        super();
    }
    
    async handle(request, targetUrl) {
        const ws = require('ws');
        const parsed = new URL(targetUrl);
        const wsUrl = `ws://${parsed.hostname}:${parsed.port || (parsed.protocol === 'https:' ? 443 : 80)}${parsed.pathname}${parsed.search}`;
        
        const clientWs = new ws(wsUrl);
        
        return new Promise((resolve, reject) => {
            clientWs.on('open', () => {
                resolve({
                    socket: clientWs,
                    onMessage: (callback) => {
                        clientWs.on('message', callback);
                    },
                    send: (data) => {
                        if (clientWs.readyState === ws.OPEN) {
                            clientWs.send(data);
                        }
                    },
                    close: () => {
                        clientWs.close();
                    }
                });
            });
            
            clientWs.on('error', reject);
        });
    }
}

module.exports = WebSocketProxy;