class Rewriter {
    constructor() {
        this.proxyPrefix = '/proxy/';
    }
    
    rewrite(content, baseUrl, contentType = 'text/html') {
        let rewritten = content;
        
        if (contentType.includes('text/html')) {
            rewritten = this.rewriteHtml(rewritten, baseUrl);
        } else if (contentType.includes('text/css')) {
            rewritten = this.rewriteCss(rewritten, baseUrl);
        } else if (contentType.includes('javascript')) {
            rewritten = this.rewriteJs(rewritten, baseUrl);
        }
        
        return rewritten;
    }
    
    rewriteHtml(content, baseUrl) {
        let rewritten = content;
        rewritten = this.rewriteSrc(rewritten, baseUrl);
        rewritten = this.rewriteHref(rewritten, baseUrl);
        rewritten = this.rewriteAction(rewritten, baseUrl);
        rewritten = this.rewriteSrcset(rewritten, baseUrl);
        rewritten = this.rewriteUrls(rewritten, baseUrl);
        rewritten = this.rewriteMetaRefresh(rewritten, baseUrl);
        rewritten = this.rewriteInlineJsUrls(rewritten, baseUrl);
        rewritten = this.rewriteRelativeLinks(rewritten, baseUrl);
        return rewritten;
    }
    
    rewriteRelativeLinks(content, baseUrl) {
        // Rewrite any href that starts with / or ./ or ../ but isn't already proxied
        return content.replace(/(href|src|action)\s*=\s*(["'])(\/[^"']*|[^"']*(?:\.\.\/|\.\/)[^"']*)\2/gi, (match, attr, quote, url) => {
            if (url.startsWith(this.proxyPrefix) || url.startsWith('javascript:') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('data:') || url.startsWith('blob:')) {
                return match;
            }
            
            const fullUrl = this.resolve(url, baseUrl);
            return `${attr}=${quote}${this.proxyPrefix}${encodeURIComponent(fullUrl)}${quote}`;
        });
    }
    
    rewriteInlineJsUrls(content, baseUrl) {
        // Rewrite window.location and location.href assignments
        return content.replace(/window\.location(?:\.href)?\s*=\s*["'](.*?)["']/gi, (match, url) => {
            if (url.startsWith(this.proxyPrefix) || url.startsWith('javascript:') || url.startsWith('#')) return match;
            const fullUrl = this.resolve(url, baseUrl);
            return `window.location.href="${this.proxyPrefix}${encodeURIComponent(fullUrl)}"`;
        });
    }
    
    rewriteMetaRefresh(content, baseUrl) {
        return content.replace(/<meta[^>]*http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*["']([^"']+)["'][^>]*>/gi, (match, refreshContent) => {
            const urlMatch = refreshContent.match(/url\s*=\s*(.+)/i);
            if (urlMatch) {
                const url = urlMatch[1].trim();
                if (!url.startsWith('data:') && !url.startsWith('#')) {
                    const fullUrl = this.resolve(url, baseUrl);
                    const newContent = refreshContent.replace(urlMatch[1].trim(), `${this.proxyPrefix}${encodeURIComponent(fullUrl)}`);
                    return match.replace(refreshContent, newContent);
                }
            }
            return match;
        });
    }
    
    rewriteSrc(content, baseUrl) {
        return content.replace(/\bsrc\s*=\s*(["'])(.*?)\1/gi, (match, quote, url) => {
            if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('blob:') || url.startsWith(this.proxyPrefix)) return match;
            const fullUrl = this.resolve(url, baseUrl);
            return `src=${quote}${this.proxyPrefix}${encodeURIComponent(fullUrl)}${quote}`;
        });
    }
    
    rewriteHref(content, baseUrl) {
        return content.replace(/\bhref\s*=\s*(["'])(.*?)\1/gi, (match, quote, url) => {
            if (url.startsWith('javascript:') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith(this.proxyPrefix)) return match;
            const fullUrl = this.resolve(url, baseUrl);
            return `href=${quote}${this.proxyPrefix}${encodeURIComponent(fullUrl)}${quote}`;
        });
    }
    
    rewriteAction(content, baseUrl) {
        return content.replace(/\baction\s*=\s*(["'])(.*?)\1/gi, (match, quote, url) => {
            if (url.startsWith('#') || url.startsWith(this.proxyPrefix)) return match;
            const fullUrl = this.resolve(url, baseUrl);
            return `action=${quote}${this.proxyPrefix}${encodeURIComponent(fullUrl)}${quote}`;
        });
    }
    
    rewriteSrcset(content, baseUrl) {
        return content.replace(/srcset\s*=\s*(["'])(.*?)\1/gi, (match, quote, srcset) => {
            const urls = srcset.split(',').map(src => {
                const parts = src.trim().split(/\s+/);
                const url = parts[0];
                if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith(this.proxyPrefix)) return src.trim();
                const fullUrl = this.resolve(url, baseUrl);
                const descriptor = parts.slice(1).join(' ');
                return `${this.proxyPrefix}${encodeURIComponent(fullUrl)}${descriptor ? ' ' + descriptor : ''}`.trim();
            });
            return `srcset=${quote}${urls.join(', ')}${quote}`;
        });
    }
    
    rewriteUrls(content, baseUrl) {
        return content.replace(/url\((['"]?)(.*?)\1\)/gi, (match, quote, url) => {
            if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('blob:') || url.startsWith(this.proxyPrefix)) return match;
            const fullUrl = this.resolve(url, baseUrl);
            return `url(${quote}${this.proxyPrefix}${encodeURIComponent(fullUrl)}${quote})`;
        });
    }
    
    rewriteCss(content, baseUrl) {
        let rewritten = this.rewriteUrls(content, baseUrl);
        rewritten = this.rewriteImports(rewritten, baseUrl);
        return rewritten;
    }
    
    rewriteImports(content, baseUrl) {
        return content.replace(/@import\s+["'](.*?)["']/gi, (match, url) => {
            if (url.startsWith(this.proxyPrefix)) return match;
            const fullUrl = this.resolve(url, baseUrl);
            return `@import "${this.proxyPrefix}${encodeURIComponent(fullUrl)}"`;
        });
    }
    
    rewriteJs(content, baseUrl) {
        let rewritten = this.rewriteFetchCalls(content, baseUrl);
        rewritten = this.rewriteAjaxCalls(rewritten, baseUrl);
        rewritten = this.rewriteInlineJsUrls(rewritten, baseUrl);
        return rewritten;
    }
    
    rewriteFetchCalls(content, baseUrl) {
        return content.replace(/fetch\s*\(\s*["'](.*?)["']/gi, (match, url) => {
            if (url.startsWith(this.proxyPrefix) || url.startsWith('data:') || url.startsWith('blob:')) return match;
            if (url.startsWith('http') || url.startsWith('//') || url.startsWith('/') || url.startsWith('.') || !url.includes('://')) {
                const fullUrl = this.resolve(url, baseUrl);
                return `fetch("${this.proxyPrefix}${encodeURIComponent(fullUrl)}"`;
            }
            return match;
        });
    }
    
    rewriteAjaxCalls(content, baseUrl) {
        return content.replace(/(XMLHttpRequest|axios\.(get|post|put|delete|patch))\s*\(\s*["'](.*?)["']/gi, (match, method, subMethod, url) => {
            if (url.startsWith(this.proxyPrefix) || url.startsWith('data:') || url.startsWith('blob:')) return match;
            if (url.startsWith('http') || url.startsWith('//') || url.startsWith('/') || url.startsWith('.')) {
                const fullUrl = this.resolve(url, baseUrl);
                return `${method}("${this.proxyPrefix}${encodeURIComponent(fullUrl)}"`;
            }
            return match;
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