# Actual Route (AR)

A high-performance proxy framework with dual-mode routing, Cloudflare bypass, and session management.

## Features

- **School Proxy Mode** - Optimized for speed and bypassing restrictions
- **Private Browser Mode** - Onion-style routing for anonymity
- **Custom Mode** - Full control over every feature
- **Session Management** - Persistent cookies and storage quotas
- **LRU Caching** - Built-in caching for speed
- **Connection Balancing** - Limits max connections
- **Modular Config** - Toggle any feature

## Installation

```bash
npm install actual-route
```

## Quick Start

```javascript
const ActualRoute = require('actual-route');

const ar = new ActualRoute();

const response = await ar.route({
    url: 'https://example.com',
    method: 'GET',
    headers: {}
}, null);

console.log(response.status);
console.log(response.body);
```

## Configuration

```javascript
const ar = new ActualRoute('./ar.config.js');
```

## Modes

- `school` - Fast proxy with Cloudflare bypass
- `private` - Onion routing with encryption
- `custom` - Manual feature control

## License

MIT