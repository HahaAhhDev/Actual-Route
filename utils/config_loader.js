const fs = require('fs');
const path = require('path');

class ConfigLoader {
    static load(configPath) {
        if (!configPath) return require('../ar.config.js');
        const resolved = path.resolve(configPath);
        if (!fs.existsSync(resolved)) throw new Error(`Config not found: ${resolved}`);
        const config = require(resolved);
        if (!config.mode) config.mode = 'school';
        if (!config.server) config.server = { port: 8080, host: '0.0.0.0' };
        if (!config.features) config.features = {};
        if (!config.sessions) config.sessions = {};
        if (!config.bypass) config.bypass = {};
        if (!config.cache) config.cache = {};
        return config;
    }
}

module.exports = ConfigLoader;