const crypto = require('crypto');

class SessionManager {
    constructor(config) {
        this.config = config;
        this.sessions = new Map();
        this.storageLimit = config.sessions?.storage_limit_mb || 50;
        this.defaultTTL = config.sessions?.default_ttl_hours || 24;
    }
    
    createSession() {
        const sessionId = crypto.randomBytes(16).toString('hex');
        this.sessions.set(sessionId, {
            id: sessionId,
            cookies: new Map(),
            storage: new Map(),
            storageUsed: 0,
            createdAt: Date.now(),
            expiresAt: Date.now() + (this.defaultTTL * 3600 * 1000)
        });
        return sessionId;
    }
    
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        
        if (Date.now() > session.expiresAt) {
            this.sessions.delete(sessionId);
            return null;
        }
        
        return session;
    }
    
    setCookie(sessionId, key, value) {
        const session = this.getSession(sessionId);
        if (!session) return false;
        session.cookies.set(key, value);
        return true;
    }
    
    getCookie(sessionId, key) {
        const session = this.getSession(sessionId);
        if (!session) return null;
        return session.cookies.get(key);
    }
    
    setStorage(sessionId, key, value) {
        const session = this.getSession(sessionId);
        if (!session) return false;
        
        const valueSize = JSON.stringify(value).length;
        if (session.storageUsed + valueSize > this.storageLimit * 1024 * 1024) {
            return false;
        }
        
        session.storage.set(key, value);
        session.storageUsed += valueSize;
        return true;
    }
    
    export(sessionId) {
        const session = this.getSession(sessionId);
        if (!session) return null;
        
        return {
            id: session.id,
            cookies: Array.from(session.cookies.entries()),
            storage: Array.from(session.storage.entries()),
            storageUsed: session.storageUsed,
            createdAt: session.createdAt
        };
    }
    
    import(data) {
        const sessionId = crypto.randomBytes(16).toString('hex');
        this.sessions.set(sessionId, {
            id: sessionId,
            cookies: new Map(data.cookies || []),
            storage: new Map(data.storage || []),
            storageUsed: data.storageUsed || 0,
            createdAt: data.createdAt || Date.now(),
            expiresAt: Date.now() + (this.defaultTTL * 3600 * 1000)
        });
        return sessionId;
    }
}

module.exports = SessionManager;