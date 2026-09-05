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
            rewritten = this.rewriteJsFile(rewritten, baseUrl);
        }

        return rewritten;
    }

    rewriteHtml(content, baseUrl) {
        let r = content;
        r = this.rewriteHref(r, baseUrl);
        r = this.rewriteSrc(r, baseUrl);
        r = this.rewriteAction(r, baseUrl);
        r = this.rewriteSrcset(r, baseUrl);
        r = this.rewriteUrls(r, baseUrl);
        r = this.injectFormHandler(r, baseUrl);
        return r;
    }

    injectFormHandler(content, baseUrl) {
        const script = `
<script>
(function() {
    function proxyUrl(url) {
        return '/proxy/' + encodeURIComponent(url);
    }
    document.addEventListener('submit', function(e) {
        var form = e.target;
        if (!form || form.tagName !== 'FORM') return;
        e.preventDefault();
        e.stopPropagation();
        
        var action = form.getAttribute('action') || '${baseUrl}';
        var method = (form.method || 'GET').toUpperCase();
        var actionUrl = new URL(action, '${baseUrl}').href;
        var formData = new FormData(form);
        var params = new URLSearchParams(formData).toString();
        var sep = actionUrl.includes('?') ? '&' : '?';
        var finalUrl = actionUrl + sep + params;
        
        window.location.href = proxyUrl(finalUrl);
    }, true);
})();
</script>`;
        if (content.includes('</body>')) {
            return content.replace('</body>', script + '</body>');
        } else {
            return content + script;
        }
    }

    rewriteHref(content, baseUrl) {
        return content.replace(/\bhref\s*=\s*(["'])(.*?)\1/gi, (match, quote, url) => {
            if (
                url.startsWith('javascript:') ||
                url.startsWith('#') ||
                url.startsWith('mailto:') ||
                url.startsWith('tel:') ||
                url.startsWith('data:') ||
                url.startsWith('blob:') ||
                url.startsWith(this.proxyPrefix)
            ) {
                return match;
            }
            const full = this.resolve(url, baseUrl);
            return `href=${quote}${this.proxyPrefix}${encodeURIComponent(full)}${quote}`;
        });
    }

    rewriteSrc(content, baseUrl) {
        return content.replace(/\bsrc\s*=\s*(["'])(.*?)\1/gi, (match, quote, url) => {
            if (
                url.startsWith('data:') ||
                url.startsWith('#') ||
                url.startsWith('blob:') ||
                url.startsWith(this.proxyPrefix)
            ) {
                return match;
            }
            const full = this.resolve(url, baseUrl);
            return `src=${quote}${this.proxyPrefix}${encodeURIComponent(full)}${quote}`;
        });
    }

    rewriteAction(content, baseUrl) {
        return content.replace(/\baction\s*=\s*(["'])(.*?)\1/gi, (match, quote, url) => {
            if (url.startsWith('#') || url.startsWith(this.proxyPrefix)) {
                return match;
            }
            const full = this.resolve(url, baseUrl);
            return `action=${quote}${this.proxyPrefix}${encodeURIComponent(full)}${quote}`;
        });
    }

    rewriteSrcset(content, baseUrl) {
        return content.replace(/srcset\s*=\s*(["'])(.*?)\1/gi, (match, quote, srcset) => {
            const urls = srcset.split(',').map(src => {
                const parts = src.trim().split(/\s+/);
                const url = parts[0];
                if (
                    url.startsWith('data:') ||
                    url.startsWith('blob:') ||
                    url.startsWith(this.proxyPrefix)
                ) {
                    return src.trim();
                }
                const full = this.resolve(url, baseUrl);
                const desc = parts.slice(1).join(' ');
                return `${this.proxyPrefix}${encodeURIComponent(full)}${desc ? ' ' + desc : ''}`.trim();
            });
            return `srcset=${quote}${urls.join(', ')}${quote}`;
        });
    }

    rewriteUrls(content, baseUrl) {
        return content.replace(/url\((['"]?)(.*?)\1\)/gi, (match, quote, url) => {
            if (
                url.startsWith('data:') ||
                url.startsWith('#') ||
                url.startsWith('blob:') ||
                url.startsWith(this.proxyPrefix)
            ) {
                return match;
            }
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

    rewriteJsFile(content, baseUrl) {
        // Don't rewrite JS files. Let them load through proxy as-is.
        // The service worker handles fetch/XHR rewriting.
        return content;
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