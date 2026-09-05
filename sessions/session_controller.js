const crypto = require('crypto');
const UserManager = require('./user.js');

class SessionController {
    constructor(config) {
        this.config = config;
        this.sessions = new Map();
        this.userManager = new UserManager(config);
        this.defaultTTL = config.sessions?.default_ttl_hours || 24;
    }
    
    createAnonymousSession() {
        const sessionId = crypto.randomBytes(16).toString('hex');
        this.sessions.set(sessionId, {
            id: sessionId,
            userId: null,
            cookies: new Map(),
            storage: new Map(),
            storageUsed: 0,
            createdAt: Date.now(),
            expiresAt: Date.now() + (this.defaultTTL * 3600 * 1000)
        });
        return sessionId;
    }
    
    createUserSession(username) {
        const sessionId = crypto.randomBytes(16).toString('hex');
        this.sessions.set(sessionId, {
            id: sessionId,
            userId: username,
            cookies: new Map(),
            storage: new Map(),
            storageUsed: 0,
            createdAt: Date.now(),
            expiresAt: Date.now() + (this.defaultTTL * 3600 * 1000)
        });
        
        this.userManager.createSessionForUser(username, sessionId);
        
        return sessionId;
    }
    
    getSession(sessionId) {
        if (!sessionId) return null;
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        if (Date.now() > session.expiresAt) {
            this.deleteSession(sessionId);
            return null;
        }
        return session;
    }
    
    deleteSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session && session.userId) {
            this.userManager.deleteSessionFromUser(session.userId, sessionId);
        }
        this.sessions.delete(sessionId);
    }
    
    listUserSessions(username) {
        return this.userManager.getUserSessions(username);
    }
    
    exportSession(sessionId) {
        const session = this.getSession(sessionId);
        if (!session) return null;
        
        return {
            id: session.id,
            userId: session.userId,
            cookies: Array.from(session.cookies.entries()),
            storage: Array.from(session.storage.entries()),
            storageUsed: session.storageUsed,
            createdAt: session.createdAt
        };
    }
    
    importSession(data) {
        const sessionId = crypto.randomBytes(16).toString('hex');
        this.sessions.set(sessionId, {
            id: sessionId,
            userId: data.userId || null,
            cookies: new Map(data.cookies || []),
            storage: new Map(data.storage || []),
            storageUsed: data.storageUsed || 0,
            createdAt: data.createdAt || Date.now(),
            expiresAt: Date.now() + (this.defaultTTL * 3600 * 1000)
        });
        
        if (data.userId) {
            this.userManager.createSessionForUser(data.userId, sessionId);
        }
        
        return sessionId;
    }
    
    setCookie(sessionId, hostname, name, value) {
        const session = this.getSession(sessionId);
        if (!session) return false;
        if (!session.cookies.has(hostname)) {
            session.cookies.set(hostname, new Map());
        }
        session.cookies.get(hostname).set(name, value);
        return true;
    }
    
    getCookies(sessionId, hostname) {
        const session = this.getSession(sessionId);
        if (!session) return null;
        const hostCookies = session.cookies.get(hostname);
        if (!hostCookies) return null;
        return Array.from(hostCookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
    }
    
    setStorage(sessionId, key, value) {
        const session = this.getSession(sessionId);
        if (!session) return false;
        
        const user = session.userId ? this.userManager.getUser(session.userId) : null;
        const storageLimit = user ? user.storageLimitMB * 1024 * 1024 : this.config.sessions?.storage_limit_mb * 1024 * 1024;
        
        const valueSize = Buffer.byteLength(JSON.stringify(value));
        if (session.storageUsed + valueSize > storageLimit) return false;
        
        session.storage.set(key, value);
        session.storageUsed += valueSize;
        
        if (user) {
            user.storageUsed = session.storageUsed;
        }
        
        return true;
    }
    
    getStorage(sessionId, key) {
        const session = this.getSession(sessionId);
        if (!session) return null;
        return session.storage.get(key);
    }
    
    removeStorage(sessionId, key) {
        const session = this.getSession(sessionId);
        if (!session) return;
        const value = session.storage.get(key);
        if (value !== undefined) {
            session.storageUsed -= Buffer.byteLength(JSON.stringify(value));
            session.storage.delete(key);
        }
    }
    
    getAllStorage(sessionId) {
        const session = this.getSession(sessionId);
        if (!session) return {};
        const result = {};
        for (const [key, value] of session.storage.entries()) {
            result[key] = value;
        }
        return result;
    }
    
    cleanupExpired() {
        const now = Date.now();
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now > session.expiresAt) {
                this.deleteSession(sessionId);
            }
        }
    }
}

module.exports = SessionController;