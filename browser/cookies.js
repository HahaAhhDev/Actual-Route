class CookieManager {
    constructor() {
        this.cookies = new Map();
    }
    
    getCookies(sessionId, hostname) {
        const key = `${sessionId}:${hostname}`;
        const cookies = this.cookies.get(key);
        if (!cookies) return null;
        
        return Array.from(cookies.entries())
            .map(([name, value]) => `${name}=${value}`)
            .join('; ');
    }
    
    setCookies(sessionId, hostname, setCookieHeaders) {
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
            
            cookieMap.set(name, value);
        }
    }
}

module.exports = CookieManager;