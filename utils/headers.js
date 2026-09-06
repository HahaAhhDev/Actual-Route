const config = require('../ar.config.js');
const { sessionManager } = require('../core/instances.js');

const SKIP_HEADERS = [
    'content-security-policy',
    'x-frame-options',
    'strict-transport-security',
    'content-length',
    'transfer-encoding',
    'connection',
    'keep-alive',
    'upgrade',
    'content-encoding',
    'vary',
    'accept-ranges',
    'set-cookie'
];

function buildHeaders(parsed, requestHeaders, session) {
    const headers = {
        'Host': parsed.hostname,
        'User-Agent': config.userAgent,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity'
    };

    const cookies = sessionManager.getCookies(session, parsed.hostname);
    if (cookies) headers['Cookie'] = cookies;
    else if (requestHeaders.cookie) headers['Cookie'] = requestHeaders.cookie;

    if (requestHeaders['content-type']) headers['Content-Type'] = requestHeaders['content-type'];
    if (requestHeaders.range) headers['Range'] = requestHeaders.range;

    if (requestHeaders.referer) {
        try {
            const refererUrl = new URL(requestHeaders.referer);
            if (refererUrl.hostname === parsed.hostname) headers['Referer'] = refererUrl.href;
        } catch (e) {}
    }
    if (requestHeaders.origin) headers['Origin'] = requestHeaders.origin;
    else if (requestHeaders.method === 'POST') headers['Origin'] = `${parsed.protocol}//${parsed.host}`;

    return headers;
}

function cleanHeaders(headers) {
    const clean = {};
    for (const key of Object.keys(headers)) {
        const lower = key.toLowerCase();
        if (!SKIP_HEADERS.includes(lower)) clean[key] = headers[key];
    }
    clean['access-control-allow-origin'] = '*';
    return clean;
}

module.exports = { buildHeaders, cleanHeaders };