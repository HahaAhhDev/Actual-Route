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
    }
    
    remove(sessionId, key) {
        const sessionStorage = this.storage.get(sessionId);
        if (sessionStorage) {
            sessionStorage.delete(key);
        }
    }
    
    clear(sessionId) {
        this.storage.delete(sessionId);
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
        if (data) {
            const sessionStorage = new Map(Object.entries(data));
            this.storage.set(sessionId, sessionStorage);
        }
    }
}

module.exports = StorageManager;