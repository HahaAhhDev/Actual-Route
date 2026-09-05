class PrivateMode {
    constructor(config) { this.config = config; }
    
    async handle(request, sessionId) {
        const BypassMode = require('./bypass.js');
        return await new BypassMode(this.config).handle(request, sessionId);
    }
}

module.exports = PrivateMode;