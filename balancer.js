const CacheManager = require('./cache/cache_manager.js');

class Balancer {
    constructor(config) {
        this.config = config;
        this.activeConnections = 0;
        this.maxConnections = config.bypass?.max_connections || 200;
        this.cache = new CacheManager(config);
    }

    async execute(mode, request, sessionId) {
        if (this.activeConnections >= this.maxConnections) {
            throw new Error('Max connections reached');
        }

        const method = request.method || 'GET';
        const url = request.url || request.targetUrl;
        const cacheKey = `${method}:${sessionId || 'anon'}:${url}`;

        if (method === 'GET' && this.config.features?.caching) {
            const cached = this.cache.get(cacheKey);
            if (cached && cached.body) {
                return {
                    ...cached,
                    body: Buffer.from(cached.body)
                };
            }
        }

        this.activeConnections++;

        try {
            let response;

            if (mode === 'school' || mode === 'custom') {
                const BypassMode = require('./modes/bypass.js');
                response = await new BypassMode(this.config).handle(request, sessionId);
            } else if (mode === 'private') {
                const PrivateMode = require('./modes/private.js');
                response = await new PrivateMode(this.config).handle(request, sessionId);
            }

            if (
                method === 'GET' &&
                response &&
                response.status === 200 &&
                this.config.features?.caching &&
                response.body &&
                Buffer.isBuffer(response.body)
            ) {
                this.cache.set(cacheKey, {
                    status: response.status,
                    headers: response.headers,
                    body: Buffer.from(response.body)
                });
            }

            return response;
        } finally {
            this.activeConnections--;
        }
    }
}

module.exports = Balancer;