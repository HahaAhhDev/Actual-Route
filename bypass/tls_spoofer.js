class TLSSpoofer {
    constructor() {
        this.browsers = {
            chrome120: {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                acceptLanguage: 'en-US,en;q=0.9',
                secChUa: '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                secChUaMobile: '?0',
                secChUaPlatform: '"Windows"'
            },
            chrome131: {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                acceptLanguage: 'en-US,en;q=0.9',
                secChUa: '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                secChUaMobile: '?0',
                secChUaPlatform: '"Windows"'
            }
        };
    }
    
    getHeaders(browser = 'chrome120') {
        const b = this.browsers[browser] || this.browsers.chrome120;
        
        return {
            'User-Agent': b.userAgent,
            'Accept': b.accept,
            'Accept-Language': b.acceptLanguage,
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-Ch-Ua': b.secChUa,
            'Sec-Ch-Ua-Mobile': b.secChUaMobile,
            'Sec-Ch-Ua-Platform': b.secChUaPlatform,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        };
    }
}

module.exports = TLSSpoofer;