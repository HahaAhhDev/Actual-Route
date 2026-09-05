const Dispatcher = require('./dispatcher.js');
const Balancer = require('./balancer.js');
const SessionController = require('./sessions/session_controller.js');
const ConfigLoader = require('./utils/config_loader.js');

const PRESETS = {
    school: {
        wisp: true,
        caching: true,
        compression: true,
        streaming: true,
        sessions: true,
        bookmarks: true,
        history: true,
        tabs: true,
        import_export: true,
        cloudflare_bypass: true,
        tls_spoofing: true,
        onion_routing: false,
        logging: false
    },
    private: {
        wisp: true,
        caching: false,
        compression: true,
        streaming: true,
        sessions: true,
        bookmarks: true,
        history: false,
        tabs: true,
        import_export: true,
        cloudflare_bypass: false,
        tls_spoofing: true,
        onion_routing: true,
        logging: false
    }
};

class ActualRoute {
    constructor(configPath) {
        this.config = ConfigLoader.load(configPath);
        this.applyPreset(this.config.mode);
        this.dispatcher = new Dispatcher(this.config);
        this.balancer = new Balancer(this.config);
        this.sessions = new SessionController(this.config);
        
        setInterval(() => {
            this.sessions.cleanupExpired();
        }, 3600 * 1000);
    }
    
    applyPreset(mode) {
        if (mode === 'custom') return;
        const preset = PRESETS[mode];
        if (preset) {
            this.config.features = { ...this.config.features, ...preset };
        }
    }
    
    async route(request, sessionId) {
        const mode = this.dispatcher.determineMode(request);
        const response = await this.balancer.execute(mode, request, sessionId);
        return response;
    }
    
    getMode() { return this.config.mode; }
    getFeatures() { return this.config.features; }
}

module.exports = ActualRoute;
