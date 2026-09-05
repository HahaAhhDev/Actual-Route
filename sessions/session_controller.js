const crypto = require('crypto');
const UserManager = require('./user.js');
const CookieManager = require('../browser/cookies.js');

const rateLimitMap = new Map();

class SessionController {
    constructor(config) {
        this.config = config;
        this.sessions = new Map();
        this.userManager = new UserManager(config);
        this.cookieManager = new CookieManager();
        this.defaultTTL = config.sessions?.default_ttl_hours || 24;
        
        setInterval(() => this.cleanupRateLimit(), 300000);
    }
    
    cleanupRateLimit() {
        const now = Date.now();
        for (const [key, requests] of rateLimitMap.entries()) {
            const valid = requests.filter(t => now - t < 60000);
            if (valid.length === 0) {
                rateLimitMap.delete(key);
            } else {
                rateLimitMap.set(key, valid);
            }
        }
    }
    
    checkRateLimit(ip) {
        const now = Date.now();
        const key = ip || 'unknown';
        if (!rateLimitMap.has(key)) rateLimitMap.set(key, []);
        const requests = rateLimitMap.get(key).filter(t => now - t < 60000);
        rateLimitMap.set(key, requests);
        if (requests.length >= 10) return false;
        requests.push(now);
        return true;
    }
    
    createAnonymousSession(ip) {
        if (!this.checkRateLimit(ip)) return null;
        return this.createSession(null);
    }
    
    createSession(userId) {
        const sessionId = crypto.randomBytes(16).toString('hex');
        this.sessions.set(sessionId, {
            id: sessionId, userId,
            storage: new Map(), storageUsed: 0,
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
    
    getCookies(sessionId, hostname) { return this.cookieManager.getCookies(sessionId, hostname); }
    setCookies(sessionId, hostname, headers) { this.cookieManager.setCookies(sessionId, hostname, headers); }
    
    getStorage(sessionId, key) {
        const session = this.getSession(sessionId);
        return session ? session.storage.get(key) : null;
    }
    
    setStorage(sessionId, key, value) {
        const session = this.getSession(sessionId);
        if (!session) return false;
        const limitMB = this.config.sessions?.storage_limit_mb || 50;
        const size = Buffer.byteLength(JSON.stringify(value));
        if (session.storageUsed + size > limitMB * 1024 * 1024) return false;
        session.storage.set(key, value);
        session.storageUsed += size;
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
        for (const [k, v] of session.storage.entries()) result[k] = v;
        return result;
    }
    
    exportSession(sessionId) {
        const session = this.getSession(sessionId);
        if (!session) return null;
        return {
            id: session.id, userId: session.userId,
            cookies: this.cookieManager.exportSessionCookies(sessionId),
            storage: this.getAllStorage(sessionId),
            storageUsed: session.storageUsed, createdAt: session.createdAt
        };
    }
    
    importSession(data, ip) {
        if (!data || !this.checkRateLimit(ip)) return null;
        const sessionId = this.createSession(data.userId || null);
        const session = this.getSession(sessionId);
        if (session) {
            if (data.storage) {
                session.storage = new Map(Object.entries(data.storage));
                session.storageUsed = Buffer.byteLength(JSON.stringify(data.storage));
            }
            if (data.cookies) this.cookieManager.importSessionCookies(sessionId, data.cookies);
        }
        return sessionId;
    }
    
    cleanupExpired() {
        const now = Date.now();
        for (const [sid, session] of this.sessions.entries()) {
            if (now > session.expiresAt) this.deleteSession(sid);
        }
    }
}

module.exports = SessionController;