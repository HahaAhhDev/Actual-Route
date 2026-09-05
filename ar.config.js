module.exports = {
    mode: 'school',
    
    server: { port: 8080, host: '0.0.0.0' },
    
    users: {
        enabled: true,
        require_login: false,
        allow_registration: true,
        max_users: 1000,
        storage_limit_mb: 50
    },
    
    features: {
        wisp: true, caching: true, compression: false, streaming: false,
        sessions: true, bookmarks: true, history: true, tabs: true,
        import_export: true, cloudflare_bypass: false, tls_spoofing: true,
        onion_routing: false, logging: false
    },
    
    sessions: {
        enabled: true,
        storage_limit_mb: 50,
        default_ttl_hours: 24,
        allow_export: true,
        allow_import: true
    },
    
    bypass: {
        enabled: true,
        cloudflare: false,
        tls_spoofing: true,
        max_connections: 200,
        timeout: 30,
        retry_attempts: 3
    },
    
    cache: { enabled: true, max_size_mb: 200, ttl_seconds: 300 }
};