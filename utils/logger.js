class Logger {
    constructor(enabled = false) { this.enabled = enabled; }
    log(level, msg) { if (this.enabled) console.log(`[${level.toUpperCase()}] ${msg}`); }
    debug(msg) { this.log('debug', msg); }
    info(msg) { this.log('info', msg); }
    warn(msg) { this.log('warn', msg); }
    error(msg) { this.log('error', msg); }
}

module.exports = Logger;