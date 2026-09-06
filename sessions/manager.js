const crypto = require('crypto');

class SessionManager {
    constructor(config) {
        this.config = config;
        this.sessions = new Map();
        this.defaultTTL = config.sessions?.default_ttl_hours || 24;
        this.cleanupInterval = setInterval(() => this.cleanupExpired(), 3600 * 1000);
    }

    createSession() {
        const sessionId = crypto.randomBytes(16).toString('hex');
        const session = {
            id: sessionId,
            cookies: new Map(),
            storage: new Map(),
            createdAt: Date.now(),
            expiresAt: Date.now() + (this.defaultTTL * 3600 * 1000)
        };
        this.sessions.set(sessionId, session);
        return session;
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
        this.sessions.delete(sessionId);
    }

    getCookies(session, hostname) {
        if (!session || !session.cookies) return null;
        const cookieMap = session.cookies.get(hostname);
        if (!cookieMap) return null;
        const now = Date.now();
        const valid = [];
        for (const [name, data] of cookieMap.entries()) {
            if (data.expires && data.expires < now) {
                cookieMap.delete(name);
                continue;
            }
            valid.push(`${name}=${data.value}`);
        }
        return valid.length > 0 ? valid.join('; ') : null;
    }

    setCookies(session, hostname, setCookieHeaders) {
        if (!session || !setCookieHeaders || setCookieHeaders.length === 0) return;
        if (!session.cookies) session.cookies = new Map();
        let cookieMap = session.cookies.get(hostname);
        if (!cookieMap) {
            cookieMap = new Map();
            session.cookies.set(hostname, cookieMap);
        }
        for (const header of setCookieHeaders) {
            const parts = header.split(';');
            const first = parts[0].trim();
            const sep = first.indexOf('=');
            if (sep === -1) continue;
            const name = first.substring(0, sep).trim();
            const value = first.substring(sep + 1).trim();
            let expires = null;
            let maxAge = null;
            for (const attr of parts.slice(1)) {
                const t = attr.trim().toLowerCase();
                if (t.startsWith('expires=')) expires = new Date(attr.trim().substring(8)).getTime();
                else if (t.startsWith('max-age=')) maxAge = parseInt(attr.trim().substring(8));
            }
            const expiry = maxAge ? Date.now() + (maxAge * 1000) : expires;
            cookieMap.set(name, { value, expires: expiry });
        }
    }

    getStorage(session, key) {
        if (!session || !session.storage) return undefined;
        return session.storage.get(key);
    }

    setStorage(session, key, value) {
        if (!session) return false;
        if (!session.storage) session.storage = new Map();
        session.storage.set(key, value);
        return true;
    }

    cleanupExpired() {
        const now = Date.now();
        for (const [id, session] of this.sessions.entries()) {
            if (now > session.expiresAt) this.sessions.delete(id);
        }
    }
}

module.exports = SessionManager;