const config = require('../ar.config.js');
const SessionManager = require('../sessions/manager.js');
const CacheManager = require('../cache/manager.js');

const sessionManager = new SessionManager(config);
const cacheManager = new CacheManager(config);

module.exports = { sessionManager, cacheManager };