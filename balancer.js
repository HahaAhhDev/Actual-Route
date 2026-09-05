class Balancer {
    constructor(config) {
        this.config = config;
        this.activeConnections = 0;
        this.maxConnections = config.bypass?.max_connections || 200;
    }
    
    async execute(mode, request, sessionId) {
        if (this.activeConnections >= this.maxConnections) {
            throw new Error('Max connections reached');
        }
        this.activeConnections++;
        try {
            let response;
            if (mode === 'school') {
                const BypassMode = require('./modes/bypass.js');
                response = await new BypassMode(this.config).handle(request, sessionId);
            } else if (mode === 'private') {
                const PrivateMode = require('./modes/private.js');
                response = await new PrivateMode(this.config).handle(request, sessionId);
            } else {
                const CustomMode = require('./modes/custom.js');
                response = await new CustomMode(this.config).handle(request, sessionId);
            }
            return response;
        } finally {
            this.activeConnections--;
        }
    }
}

module.exports = Balancer;