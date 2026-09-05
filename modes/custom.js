class CustomMode {
    constructor(config) {
        this.config = config;
    }
    
    async handle(request, sessionId) {
        const targetUrl = request.url || request.targetUrl;
        if (!targetUrl) return { status: 400, body: 'No target URL' };
        
        if (this.config.features?.onion_routing) {
            const PrivateMode = require('./private.js');
            return await new PrivateMode(this.config).handle(request, sessionId);
        }
        
        const BypassMode = require('./bypass.js');
        return await new BypassMode(this.config).handle(request, sessionId);
    }
}

module.exports = CustomMode;