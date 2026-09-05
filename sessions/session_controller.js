const crypto = require('crypto');
const UserManager = require('./user.js');
const CookieManager = require('../browser/cookies.js');

const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60000;

class SessionController {
    constructor(config) {
        this.config = config;
        this.sessions = new Map();
        this.userManager = new UserManager(config);
        this.cookieManager = new CookieManager();
        this.defaultTTL = config.sessions?.default_ttl_hours || 24;
    }
    
    checkRateLimit(ip) {
        const now = Date.now();
        const key = ip || 'unknown';
        
        if (!rateLimitMap.has(key)) {
            rateLimitMap.set(key, []);
        }
        
        const requests = rateLimitMap.get(key).filter(t => now - t < RATE_LIMIT_WINDOW);
        rateLimitMap.set(key, requests);
        
        if (requests.length >= RATE_LIMIT_MAX) return false;
        
        requests.push(now);
        return true;
    }
    
    createAnonymousSession(ip) {
        if (!this.checkRateLimit(ip)) return null;
        return this.createSession(null);
    }
    
    createUserSession(username, ip) {
        if (!this.checkRateLimit(ip)) return null;
        return this.createSession(username);
    }
    
    createSession(userId) {
        const sessionId = crypto.randomBytes(16).toString('hex');
        this.sessions.set(sessionId, {
            id: sessionId,
            userId,
            cookies: new Map(),
            storage: new Map(),
            storageUsed: 0,
            createdAt: Date.now(),
            expiresAt: Date.now() + (this.defaultTTL * 3600 * 1000)
        });
        if (userId) this.userManager.addSessionToUser(userId, sessionId);
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
        if (session && session.userId) this.userManager.removeSessionFromUser(session.userId, sessionId);
        this.sessions.delete(sessionId);
        this.cookieManager.clearSession(sessionId);
    }
    
    listSessions(username) {
        const user = this.userManager.getUser(username);
        return user ? user.sessions || [] : [];
    }
    
    listAllSessions() { return Array.from(this.sessions.keys()); }
    
    getCookies(sessionId, hostname) { return this.cookieManager.getCookies(sessionId, hostname); }
    setCookies(sessionId, hostname, headers) { this.cookieManager.setCookies(sessionId, hostname, headers); }
    
    getStorage(sessionId, key) {
        const session = this.getSession(sessionId);
        return session ? session.storage.get(key) : null;
    }
    
    setStorage(sessionId, key, value) {
        const session = this.getSession(sessionId);
        if (!session) return false;
        const limitMB = session.userId 
            ? (this.userManager.getUser(session.userId)?.storageLimitMB || this.config.sessions?.storage_limit_mb || 50)
            : (this.config.sessions?.storage_limit_mb || 50);
        const valueSize = Buffer.byteLength(JSON.stringify(value));
        if (session.storageUsed + valueSize > limitMB * 1024 * 1024) return false;
        session.storage.set(key, value);
        session.storageUsed += valueSize;
        return true;
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
        for (const [key, value] of session.storage.entries()) result[key] = value;
        return result;
    }
    
    importStorage(sessionId, data) {
        const session = this.getSession(sessionId);
        if (!session) return;
        session.storage = new Map(Object.entries(data || {}));
        session.storageUsed = Buffer.byteLength(JSON.stringify(data || {}));
    }
    
    exportSession(sessionId) {
        const session = this.getSession(sessionId);
        if (!session) return null;
        return {
            id: session.id,
            userId: session.userId,
            cookies: this.cookieManager.exportSessionCookies(sessionId),
            storage: this.getAllStorage(sessionId),
            storageUsed: session.storageUsed,
            createdAt: session.createdAt
        };
    }
    
    importSession(data, ip) {
        if (!data) return null;
        if (!this.checkRateLimit(ip)) return null;
        const sessionId = this.createSession(data.userId || null);
        const session = this.getSession(sessionId);
        if (session) {
            session.createdAt = data.createdAt || Date.now();
            session.storageUsed = data.storageUsed || 0;
            if (data.storage) this.importStorage(sessionId, data.storage);
            if (data.cookies) this.cookieManager.importSessionCookies(sessionId, data.cookies);
        }
        return sessionId;
    }
    
    cleanupExpired() {
        const now = Date.now();
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now > session.expiresAt) this.deleteSession(sessionId);
        }
    }
}

module.exports = SessionController;
