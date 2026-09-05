class Rewriter {
    constructor() {
        this.proxyPrefix = '/proxy/';
    }
    
    rewrite(content, baseUrl, contentType = 'text/html') {
        let rewritten = content;
        
        if (contentType.includes('text/html')) rewritten = this.rewriteHtml(rewritten, baseUrl);
        else if (contentType.includes('text/css')) rewritten = this.rewriteCss(rewritten, baseUrl);
        else if (contentType.includes('javascript')) rewritten = this.rewriteJs(rewritten, baseUrl);
        
        return rewritten;
    }
    
    rewriteHtml(content, baseUrl) {
        let r = content;
        r = this.rewriteHref(r, baseUrl);
        r = this.rewriteSrc(r, baseUrl);
        r = this.rewriteAction(r, baseUrl);
        r = this.rewriteSrcset(r, baseUrl);
        r = this.rewriteUrls(r, baseUrl);
        return r;
    }
    
    rewriteHref(content, baseUrl) {
        return content.replace(/\bhref\s*=\s*(["'])(.*?)\1/gi, (match, quote, url) => {
            if (url.startsWith('javascript:') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith(this.proxyPrefix)) return match;
            const full = this.resolve(url, baseUrl);
            return `href=${quote}${this.proxyPrefix}${encodeURIComponent(full)}${quote}`;
        });
    }
    
    rewriteSrc(content, baseUrl) {
        return content.replace(/\bsrc\s*=\s*(["'])(.*?)\1/gi, (match, quote, url) => {
            if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('blob:') || url.startsWith(this.proxyPrefix)) return match;
            const full = this.resolve(url, baseUrl);
            return `src=${quote}${this.proxyPrefix}${encodeURIComponent(full)}${quote}`;
        });
    }
    
    rewriteAction(content, baseUrl) {
        return content.replace(/\baction\s*=\s*(["'])(.*?)\1/gi, (match, quote, url) => {
            if (url.startsWith('#') || url.startsWith(this.proxyPrefix)) return match;
            const full = this.resolve(url, baseUrl);
            return `action=${quote}${this.proxyPrefix}${encodeURIComponent(full)}${quote}`;
        });
    }
    
    rewriteSrcset(content, baseUrl) {
        return content.replace(/srcset\s*=\s*(["'])(.*?)\1/gi, (match, quote, srcset) => {
            const urls = srcset.split(',').map(src => {
                const parts = src.trim().split(/\s+/);
                const url = parts[0];
                if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith(this.proxyPrefix)) return src.trim();
                const full = this.resolve(url, baseUrl);
                const desc = parts.slice(1).join(' ');
                return `${this.proxyPrefix}${encodeURIComponent(full)}${desc ? ' ' + desc : ''}`.trim();
            });
            return `srcset=${quote}${urls.join(', ')}${quote}`;
        });
    }
    
    rewriteUrls(content, baseUrl) {
        return content.replace(/url\((['"]?)(.*?)\1\)/gi, (match, quote, url) => {
            if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('blob:') || url.startsWith(this.proxyPrefix)) return match;
            const full = this.resolve(url, baseUrl);
            return `url(${quote}${this.proxyPrefix}${encodeURIComponent(full)}${quote})`;
        });
    }
    
    rewriteCss(content, baseUrl) {
        let r = this.rewriteUrls(content, baseUrl);
        r = r.replace(/@import\s+["'](.*?)["']/gi, (match, url) => {
            if (url.startsWith(this.proxyPrefix)) return match;
            return `@import "${this.proxyPrefix}${encodeURIComponent(this.resolve(url, baseUrl))}"`;
        });
        return r;
    }
    
    rewriteJs(content, baseUrl) {
        return content.replace(/fetch\s*\(\s*["'](.*?)["']/gi, (match, url) => {
            if (url.startsWith(this.proxyPrefix) || url.startsWith('data:') || url.startsWith('blob:')) return match;
            const full = this.resolve(url, baseUrl);
            return `fetch("${this.proxyPrefix}${encodeURIComponent(full)}"`;
        });
    }
    
    resolve(url, baseUrl) {
        try {
            if (url.startsWith('//')) return 'https:' + url;
            return new URL(url, baseUrl).href;
        } catch {
            return url;
        }
    }
}

module.exports = Rewriter;