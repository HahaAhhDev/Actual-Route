class Logger {
    constructor(enabled = false) {
        this.enabled = enabled;
    }
    
    log(level, message) {
        if (!this.enabled) return;
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }
    
    debug(msg) { this.log('debug', msg); }
    info(msg) { this.log('info', msg); }
    warn(msg) { this.log('warn', msg); }
    error(msg) { this.log('error', msg); }
}

module.exports = Logger;