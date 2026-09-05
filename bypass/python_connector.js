const http = require('http');

class PythonBypassConnector {
    constructor() {
        this.serviceUrl = 'http://localhost:5000';
    }
    
    async fetch(url, method, headers, body) {
        return new Promise((resolve, reject) => {
            const payload = JSON.stringify({ url, method, headers, body });
            
            const options = {
                hostname: 'localhost',
                port: 5000,
                path: '/fetch',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            };
            
            const req = http.request(options, (res) => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    stream: res
                });
            });
            
            req.on('error', reject);
            req.write(payload);
            req.end();
        });
    }
}

module.exports = PythonBypassConnector;