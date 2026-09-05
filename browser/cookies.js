const MAX_COOKIES_PER_HOST = 100;

class CookieManager {
    constructor() {
        this.cookies = new Map();
    }

    getCookies(sessionId, hostname) {
        const key = `${sessionId}:${hostname}`;
        const cookies = this.cookies.get(key);
        
        if (!cookies) {
            return null;
        }

        const now = Date.now();
        const valid = [];

        for (const [name, data] of cookies.entries()) {
            if (data.expires && data.expires < now) {
                cookies.delete(name);
                continue;
            }
            valid.push(`${name}=${data.value}`);
        }

        return valid.length > 0 ? valid.join('; ') : null;
    }

    setCookies(sessionId, hostname, setCookieHeaders) {
        if (!setCookieHeaders || setCookieHeaders.length === 0) {
            return;
        }

        const key = `${sessionId}:${hostname}`;
        
        if (!this.cookies.has(key)) {
            this.cookies.set(key, new Map());
        }

        const cookieMap = this.cookies.get(key);

        for (const header of setCookieHeaders) {
            if (cookieMap.size >= MAX_COOKIES_PER_HOST) {
                break;
            }

            const parts = header.split(';');
            const first = parts[0].trim();
            const sep = first.indexOf('=');
            
            if (sep === -1) {
                continue;
            }

            const name = first.substring(0, sep).trim();
            const value = first.substring(sep + 1).trim();

            let expires = null;
            let maxAge = null;

            for (const attr of parts.slice(1)) {
                const trimmed = attr.trim().toLowerCase();
                
                if (trimmed.startsWith('expires=')) {
                    expires = new Date(attr.trim().substring(8)).getTime();
                } else if (trimmed.startsWith('max-age=')) {
                    maxAge = parseInt(attr.trim().substring(8));
                }
            }

            const expiryTime = maxAge ? Date.now() + (maxAge * 1000) : expires;
            cookieMap.set(name, { value, expires: expiryTime });
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
            const limited = cookies.slice(0, MAX_COOKIES_PER_HOST);
            this.cookies.set(`${sessionId}:${hostname}`, new Map(limited));
        }
    }
}

module.exports = CookieManager;