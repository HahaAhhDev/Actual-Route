class CookieManager {
    constructor() {
        this.cookies = new Map();
        this.cleanupInterval = setInterval(() => this.cleanup(), 3600 * 1000);
    }
    
    getCookies(sessionId, hostname) {
        const key = `${sessionId}:${hostname}`;
        const cookies = this.cookies.get(key);
        if (!cookies) return null;
        
        const now = Date.now();
        const validCookies = [];
        
        for (const [name, cookieData] of cookies.entries()) {
            if (cookieData.expires && cookieData.expires < now) {
                cookies.delete(name);
                continue;
            }
            validCookies.push(`${name}=${cookieData.value}`);
        }
        
        return validCookies.length > 0 ? validCookies.join('; ') : null;
    }
    
    setCookies(sessionId, hostname, setCookieHeaders) {
        if (!setCookieHeaders || setCookieHeaders.length === 0) return;
        
        const key = `${sessionId}:${hostname}`;
        if (!this.cookies.has(key)) {
            this.cookies.set(key, new Map());
        }
        
        const cookieMap = this.cookies.get(key);
        
        for (const header of setCookieHeaders) {
            const parts = header.split(';');
            const firstPart = parts[0].trim();
            const separator = firstPart.indexOf('=');
            
            if (separator === -1) continue;
            
            const name = firstPart.substring(0, separator).trim();
            const value = firstPart.substring(separator + 1).trim();
            
            let expires = null;
            let maxAge = null;
            
            for (const attr of parts.slice(1)) {
                const trimmed = attr.trim();
                const lower = trimmed.toLowerCase();
                
                if (lower.startsWith('expires=')) {
                    expires = new Date(trimmed.substring(8)).getTime();
                } else if (lower.startsWith('max-age=')) {
                    maxAge = parseInt(trimmed.substring(8));
                }
            }
            
            const expiryTime = maxAge ? Date.now() + (maxAge * 1000) : expires;
            
            cookieMap.set(name, {
                value,
                expires: expiryTime
            });
        }
    }
    
    clearSession(sessionId) {
        for (const key of this.cookies.keys()) {
            if (key.startsWith(`${sessionId}:`)) {
                this.cookies.delete(key);
            }
        }
    }
    
    exportSessionCookies(sessionId) {
        const result = {};
        for (const [key, cookies] of this.cookies.entries()) {
            if (key.startsWith(`${sessionId}:`)) {
                const hostname = key.substring(sessionId.length + 1);
                result[hostname] = Array.from(cookies.entries());
            }
        }
        return result;
    }
    
    importSessionCookies(sessionId, data) {
        for (const [hostname, cookies] of Object.entries(data || {})) {
            const key = `${sessionId}:${hostname}`;
            this.cookies.set(key, new Map(cookies));
        }
    }
    
    cleanup() {
        const now = Date.now();
        for (const [key, cookies] of this.cookies.entries()) {
            for (const [name, cookieData] of cookies.entries()) {
                if (cookieData.expires && cookieData.expires < now) {
                    cookies.delete(name);
                }
            }
            if (cookies.size === 0) {
                this.cookies.delete(key);
            }
        }
    }
}

module.exports = CookieManager;