const zlib = require('zlib');
const config = require('../ar.config.js');
const rewriter = require('../rewriter/index.js');

function process(proxyReq, proxyRes, contentType, baseUrl, responseHeaders, session, method) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let totalSize = 0;
        const maxSize = contentType.includes('text/html') ? config.maxHtmlSize : config.maxAssetSize;

        proxyRes.on('data', (chunk) => {
            totalSize += chunk.length;
            if (totalSize > maxSize) {
                proxyReq.destroy();
                reject(new Error('Too large'));
                return;
            }
            chunks.push(chunk);
        });

        proxyRes.on('end', () => {
            let buffer = Buffer.concat(chunks);

            const encoding = proxyRes.headers['content-encoding'];
            try {
                if (encoding === 'gzip') buffer = zlib.gunzipSync(buffer);
                else if (encoding === 'deflate') buffer = zlib.inflateSync(buffer);
                else if (encoding === 'br') buffer = zlib.brotliDecompressSync(buffer);
            } catch (e) {}

            let content = buffer.toString('utf-8');

            if (contentType.includes('text/html')) {
                content = rewriter.rewriteHtml(content, baseUrl);
            } else if (contentType.includes('text/css')) {
                content = rewriter.rewriteCss(content, baseUrl);
            } else if (contentType.includes('javascript')) {
                content = rewriter.rewriteJs(content, baseUrl);
            }

            buffer = Buffer.from(content, 'utf-8');
            responseHeaders['content-type'] = contentType;
            responseHeaders['content-length'] = buffer.length;

            resolve({ status: proxyRes.statusCode, headers: responseHeaders, body: buffer });
        });

        proxyRes.on('error', reject);
    });
}

module.exports = { process };