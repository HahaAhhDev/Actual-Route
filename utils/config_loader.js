const fs = require('fs');
const path = require('path');

class ConfigLoader {
    static load(configPath) {
        if (!configPath) {
            return require('../ar.config.js');
        }
        
        const resolvedPath = path.resolve(configPath);
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`Config file not found: ${resolvedPath}`);
        }
        
        const config = require(resolvedPath);
        ConfigLoader.validate(config);
        return config;
    }
    
    static validate(config) {
        if (!config.mode) config.mode = 'school';
        if (!['school', 'private', 'custom'].includes(config.mode)) {
            config.mode = 'school';
        }
        
        if (!config.server) config.server = {};
        if (!config.server.port) config.server.port = 8080;
        if (!config.server.host) config.server.host = '0.0.0.0';
        
        if (!config.features) config.features = {};
        if (!config.sessions) config.sessions = {};
        if (!config.bypass) config.bypass = {};
        if (!config.cache) config.cache = {};
        
        return config;
    }
}

module.exports = ConfigLoader;
