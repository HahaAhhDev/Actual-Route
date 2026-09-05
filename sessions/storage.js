class StorageManager {
    constructor() {
        this.storage = new Map();
    }
    
    get(sessionId, key) {
        const sessionStorage = this.storage.get(sessionId);
        if (!sessionStorage) return null;
        return sessionStorage.get(key);
    }
    
    set(sessionId, key, value) {
        if (!this.storage.has(sessionId)) {
            this.storage.set(sessionId, new Map());
        }
        this.storage.get(sessionId).set(key, value);
        return true;
    }
    
    remove(sessionId, key) {
        const sessionStorage = this.storage.get(sessionId);
        if (sessionStorage) sessionStorage.delete(key);
    }
    
    getAll(sessionId) {
        const sessionStorage = this.storage.get(sessionId);
        if (!sessionStorage) return {};
        const result = {};
        for (const [key, value] of sessionStorage.entries()) {
            result[key] = value;
        }
        return result;
    }
    
    import(sessionId, data) {
        this.storage.set(sessionId, new Map(Object.entries(data || {})));
    }
    
    clear(sessionId) {
        this.storage.delete(sessionId);
    }
}

module.exports = StorageManager;