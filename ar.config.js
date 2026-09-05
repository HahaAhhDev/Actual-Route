module.exports = {
    mode: 'school', // 'school' | 'private' | 'custom'
    
    server: {
        port: 8080,
        host: '0.0.0.0'
    },
    
    features: {
        wisp: true,
        caching: true,
        compression: true,
        streaming: true,
        sessions: true,
        bookmarks: true,
        history: true,
        tabs: true,
        import_export: true,
        cloudflare_bypass: false,
        tls_spoofing: false,
        onion_routing: false,
        logging: false
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
        tls_spoofing: false,
        challenge_solver: 'automatic',
        max_connections: 50,
        timeout: 20,
        retry_attempts: 2
    },
    
    private: {
        enabled: true,
        routing: 'onion',
        min_hops: 2,
        max_hops: 5,
        signal_transfer_rate: 'rare'
    },
    
    cache: {
        enabled: true,
        max_size_mb: 100,
        ttl_seconds: 300
    }
};