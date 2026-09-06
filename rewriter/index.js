function rewriteHtml(html, baseUrl) {
    let result = html;

    result = result.replace(/\bsrc\s*=\s*(["'])(.*?)\1/gi, (m, q, url) => {
        if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('blob:') || url.startsWith('/proxy/')) return m;
        const full = new URL(url, baseUrl).href;
        return `src=${q}/proxy/${encodeURIComponent(full)}${q}`;
    });

    result = result.replace(/\bhref\s*=\s*(["'])(.*?)\1/gi, (m, q, url) => {
        if (url.startsWith('javascript:') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('data:') || url.startsWith('/proxy/')) return m;
        const full = new URL(url, baseUrl).href;
        return `href=${q}/proxy/${encodeURIComponent(full)}${q}`;
    });

    result = result.replace(/\baction\s*=\s*(["'])(.*?)\1/gi, (m, q, url) => {
        if (url.startsWith('#') || url.startsWith('/proxy/')) return m;
        const full = new URL(url, baseUrl).href;
        return `action=${q}/proxy/${encodeURIComponent(full)}${q}`;
    });

    result = result.replace(/srcset\s*=\s*(["'])(.*?)\1/gi, (m, q, srcset) => {
        const urls = srcset.split(',').map(src => {
            const parts = src.trim().split(/\s+/);
            const url = parts[0];
            if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/proxy/')) return src.trim();
            const full = new URL(url, baseUrl).href;
            const desc = parts.slice(1).join(' ');
            return `/proxy/${encodeURIComponent(full)}${desc ? ' ' + desc : ''}`.trim();
        });
        return `srcset=${q}${urls.join(', ')}${q}`;
    });

    result = result.replace(/url\((['"]?)(.*?)\1\)/gi, (m, q, url) => {
        if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('blob:') || url.startsWith('/proxy/')) return m;
        const full = new URL(url, baseUrl).href;
        return `url(${q}/proxy/${encodeURIComponent(full)}${q})`;
    });

    result = result.replace(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi, (match, code) => {
        let rewritten = rewriteJs(code, baseUrl);
        return match.replace(code, rewritten);
    });

    return result;
}

function rewriteCss(css, baseUrl) {
    let result = css;

    result = result.replace(/url\((['"]?)(.*?)\1\)/gi, (m, q, url) => {
        if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('blob:') || url.startsWith('/proxy/')) return m;
        const full = new URL(url, baseUrl).href;
        return `url(${q}/proxy/${encodeURIComponent(full)}${q})`;
    });

    result = result.replace(/@import\s+["'](.*?)["']/gi, (m, url) => {
        if (url.startsWith('/proxy/')) return m;
        const full = new URL(url, baseUrl).href;
        return `@import "/proxy/${encodeURIComponent(full)}"`;
    });

    return result;
}

function rewriteJs(js, baseUrl) {
    let result = js;

    // fetch("...") and fetch('...')
    result = result.replace(/fetch\s*\(\s*["'](.*?)["']/gi, (m, url) => {
        if (url.startsWith('/proxy/') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('#')) return m;
        const full = new URL(url, baseUrl).href;
        return `fetch("/proxy/${encodeURIComponent(full)}"`;
    });

    // fetch(`...`)
    result = result.replace(/fetch\s*\(\s*`(.*?)`/gi, (m, url) => {
        if (url.startsWith('/proxy/') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('#')) return m;
        const full = new URL(url, baseUrl).href;
        return `fetch(\`/proxy/${encodeURIComponent(full)}\``;
    });

    // new WebSocket("wss://...")
    result = result.replace(/new\s+WebSocket\s*\(\s*["'](wss?:\/\/.*?)["']/gi, (m, url) => {
        const full = new URL(url, baseUrl).href;
        return `new WebSocket("/ws/${encodeURIComponent(full)}"`;
    });

    // window.location.href = "..."
    result = result.replace(/window\.location(?:\.href)?\s*=\s*["'](.*?)["']/gi, (m, url) => {
        if (url.startsWith('/proxy/') || url.startsWith('javascript:') || url.startsWith('#')) return m;
        const full = new URL(url, baseUrl).href;
        return `window.location.href="/proxy/${encodeURIComponent(full)}"`;
    });

    // location.href = "..."
    result = result.replace(/location\.href\s*=\s*["'](.*?)["']/gi, (m, url) => {
        if (url.startsWith('/proxy/') || url.startsWith('javascript:') || url.startsWith('#')) return m;
        const full = new URL(url, baseUrl).href;
        return `location.href="/proxy/${encodeURIComponent(full)}"`;
    });

    // Relative paths starting with "/" (but not "//" or "/proxy/")
    // e.g. "/results?search_query=..." → "/proxy/<baseUrl>/results?search_query=..."
    result = result.replace(/["'](\/[^"'\s]*)["']/g, (m, path) => {
        if (path.startsWith('//') || path.startsWith('/proxy/') || path === '/') return m;
        const full = new URL(path, baseUrl).href;
        return `"/proxy/${encodeURIComponent(full)}"`;
    });

    return result;
}

module.exports = { rewriteHtml, rewriteCss, rewriteJs };