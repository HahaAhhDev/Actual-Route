class Rewriter {
    constructor() {
        this.proxyPrefix = '/proxy/';
    }
    
    rewrite(html, baseUrl) {
        let rewritten = html;
        
        rewritten = this.rewriteUrls(rewritten, baseUrl);
        rewritten = this.rewriteSrc(rewritten, baseUrl);
        rewritten = this.rewriteHref(rewritten, baseUrl);
        rewritten = this.rewriteAction(rewritten, baseUrl);
        rewritten = this.rewriteCssUrls(rewritten, baseUrl);
        rewritten = this.rewriteJsUrls(rewritten, baseUrl);
        
        return rewritten;
    }
    
    rewriteUrls(content, baseUrl) {
        return content.replace(/url\((['"]?)(.*?)\1\)/gi, (match, quote, url) => {
            if (url.startsWith('data:') || url.startsWith('#')) return match;
            const fullUrl = this.resolve(url, baseUrl);
            return `url(${quote}${this.proxyPrefix}${encodeURIComponent(fullUrl)}${quote})`;
        });
    }
    
    rewriteSrc(content, baseUrl) {
        return content.replace(/\bsrc\s*=\s*(["'])(.*?)\1/gi, (match, quote, url) => {
            if (url.startsWith('data:') || url.startsWith('#')) return match;
            const fullUrl = this.resolve(url, baseUrl);
            return `src=${quote}${this.proxyPrefix}${encodeURIComponent(fullUrl)}${quote}`;
        });
    }
    
    rewriteHref(content, baseUrl) {
        return content.replace(/\bhref\s*=\s*(["'])(.*?)\1/gi, (match, quote, url) => {
            if (url.startsWith('javascript:') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('data:')) return match;
            const fullUrl = this.resolve(url, baseUrl);
            return `href=${quote}${this.proxyPrefix}${encodeURIComponent(fullUrl)}${quote}`;
        });
    }
    
    rewriteAction(content, baseUrl) {
        return content.replace(/\baction\s*=\s*(["'])(.*?)\1/gi, (match, quote, url) => {
            if (url.startsWith('#')) return match;
            const fullUrl = this.resolve(url, baseUrl);
            return `action=${quote}${this.proxyPrefix}${encodeURIComponent(fullUrl)}${quote}`;
        });
    }
    
    rewriteCssUrls(content, baseUrl) {
        return content.replace(/@import\s+["'](.*?)["']/gi, (match, url) => {
            const fullUrl = this.resolve(url, baseUrl);
            return `@import "${this.proxyPrefix}${encodeURIComponent(fullUrl)}"`;
        });
    }
    
    rewriteJsUrls(content, baseUrl) {
        return content.replace(/(fetch|XMLHttpRequest|axios\.get|axios\.post|axios\.put|axios\.delete)\s*\(\s*["'](.*?)["']/gi, (match, method, url) => {
            if (url.startsWith('http') || url.startsWith('//') || url.startsWith('/')) {
                const fullUrl = this.resolve(url, baseUrl);
                return `${method}("${this.proxyPrefix}${encodeURIComponent(fullUrl)}"`;
            }
            return match;
        });
    }
    
    resolve(url, baseUrl) {
        try {
            return new URL(url, baseUrl).href;
        } catch {
            return url;
        }
    }
}

module.exports = Rewriter;