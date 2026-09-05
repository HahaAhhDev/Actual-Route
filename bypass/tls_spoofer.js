class TLSSpoofer {
    constructor() {
        this.browserFingerprints = {
            chrome120: {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                acceptLanguage: 'en-US,en;q=0.9',
                acceptEncoding: 'gzip, deflate, br',
                secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                secChUaMobile: '?0',
                secChUaPlatform: '"Windows"'
            },
            firefox120: {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                acceptLanguage: 'en-US,en;q=0.5',
                acceptEncoding: 'gzip, deflate, br'
            }
        };
    }
    
    getFingerprint(browser = 'chrome120') {
        return this.browserFingerprints[browser] || this.browserFingerprints.chrome120;
    }
    
    buildHeaders(browser = 'chrome120') {
        const fp = this.getFingerprint(browser);
        
        const headers = {
            'User-Agent': fp.userAgent,
            'Accept': fp.accept,
            'Accept-Language': fp.acceptLanguage,
            'Accept-Encoding': fp.acceptEncoding,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };
        
        if (fp.secChUa) {
            headers['Sec-Ch-Ua'] = fp.secChUa;
            headers['Sec-Ch-Ua-Mobile'] = fp.secChUaMobile;
            headers['Sec-Ch-Ua-Platform'] = fp.secChUaPlatform;
        }
        
        return headers;
    }
}

module.exports = TLSSpoofer;