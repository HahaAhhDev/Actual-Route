module.exports = {
    port: 8080,
    host: '0.0.0.0',
    mode: 'school',
    maxBodySize: 10 * 1024 * 1024,
    maxHtmlSize: 50 * 1024 * 1024,
    maxAssetSize: 20 * 1024 * 1024,
    timeout: 30,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    sessions: {
        enabled: true,
        default_ttl_hours: 24,
        storage_limit_mb: 50
    },
    cache: {
        enabled: true,
        max_size_mb: 100,
        ttl_seconds: 300
    }
};