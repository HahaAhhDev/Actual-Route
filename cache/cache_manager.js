const LRUCache = require('./lru.js');

class CacheManager {
    constructor(config) {
        this.config = config;
        this.enabled = config.cache?.enabled !== false;
        this.ttl = config.cache?.ttl_seconds || 300;
        this.cache = new LRUCache(config.cache?.max_size_mb || 200);
        this.timestamps = new Map();
    }
    
    get(key) {
        if (!this.enabled) return null;
        const timestamp = this.timestamps.get(key);
        if (timestamp && Date.now() - timestamp > this.ttl * 1000) {
            this.cache.delete(key);
            this.timestamps.delete(key);
            return null;
        }
        return this.cache.get(key);
    }
    
    set(key, value) {
        if (!this.enabled) return;
        this.cache.set(key, value);
        this.timestamps.set(key, Date.now());
    }
    
    has(key) {
        return this.cache.has(key);
    }
    
    clear() {
        this.cache.clear();
        this.timestamps.clear();
    }
}

module.exports = CacheManager;
