const Dispatcher = require('./dispatcher.js');
const Balancer = require('./balancer.js');
const SessionController = require('./sessions/session_controller.js');
const ConfigLoader = require('./utils/config_loader.js');
const Logger = require('./utils/logger.js');

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
        cloudflare_bypass: false,
        tls_spoofing: true,
        onion_routing: false,
        logging: true
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
        logging: true
    }
};

class ActualRoute {
    constructor(configPath) {
        this.config = ConfigLoader.load(configPath);
        this.applyPreset(this.config.mode);
        this.logger = new Logger(this.config.logging || {});
        this.dispatcher = new Dispatcher(this.config);
        this.balancer = new Balancer(this.config);
        this.sessions = new SessionController(this.config);

        // Periodic cleanup of expired sessions
        setInterval(() => {
            this.sessions.cleanupExpired();
        }, 3600 * 1000);

        this.logger.info('Actual Route initialized');
        this.logger.info(`Mode: ${this.config.mode}`);
    }

    applyPreset(mode) {
        if (mode === 'custom') {
            return;
        }

        const preset = PRESETS[mode];
        if (preset) {
            this.config.features = {
                ...this.config.features,
                ...preset
            };
        }
    }

    async route(request, sessionId) {
        const mode = this.dispatcher.determineMode(request);
        this.logger.debug(`Routing request: ${request.url} in ${mode} mode`);
        const response = await this.balancer.execute(mode, request, sessionId);
        return response;
    }

    getMode() {
        return this.config.mode;
    }

    getFeatures() {
        return this.config.features;
    }
}

module.exports = ActualRoute;