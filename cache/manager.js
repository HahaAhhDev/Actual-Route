class LRUCache {
    constructor(maxSizeMB = 100) {
        this.maxSize = maxSizeMB * 1024 * 1024;
        this.currentSize = 0;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        const size = Buffer.byteLength(JSON.stringify(value));
        if (size > this.maxSize) return;
        if (this.cache.has(key)) {
            this.currentSize -= Buffer.byteLength(JSON.stringify(this.cache.get(key)));
            this.cache.delete(key);
        }
        while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
            const oldest = this.cache.keys().next().value;
            this.currentSize -= Buffer.byteLength(JSON.stringify(this.cache.get(oldest)));
            this.cache.delete(oldest);
        }
        this.cache.set(key, value);
        this.currentSize += size;
    }

    has(key) {
        return this.cache.has(key);
    }

    clear() {
        this.cache.clear();
        this.currentSize = 0;
    }
}

class CacheManager {
    constructor(config) {
        this.enabled = config.cache?.enabled !== false;
        this.ttl = config.cache?.ttl_seconds || 300;
        this.cache = new LRUCache(config.cache?.max_size_mb || 100);
        this.timestamps = new Map();
    }

    get(key) {
        if (!this.enabled) return null;
        const ts = this.timestamps.get(key);
        if (ts && Date.now() - ts > this.ttl * 1000) {
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
}

module.exports = CacheManager;