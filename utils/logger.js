class Logger {
    constructor(enabled = false) {
        this.enabled = enabled;
    }
    
    log(level, message) {
        if (!this.enabled) return;
        console.log(`[${level.toUpperCase()}] ${message}`);
    }
    
    debug(message) { this.log('debug', message); }
    info(message) { this.log('info', message); }
    warn(message) { this.log('warn', message); }
    error(message) { this.log('error', message); }
}

module.exports = Logger;