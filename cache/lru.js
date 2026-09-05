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
        const valueSize = JSON.stringify(value).length;
        
        if (valueSize > this.maxSize) return;
        
        if (this.cache.has(key)) {
            this.currentSize -= JSON.stringify(this.cache.get(key)).length;
            this.cache.delete(key);
        }
        
        while (this.currentSize + valueSize > this.maxSize && this.cache.size > 0) {
            const oldestKey = this.cache.keys().next().value;
            this.currentSize -= JSON.stringify(this.cache.get(oldestKey)).length;
            this.cache.delete(oldestKey);
        }
        
        this.cache.set(key, value);
        this.currentSize += valueSize;
    }
    
    clear() {
        this.cache.clear();
        this.currentSize = 0;
    }
}

module.exports = LRUCache;