class Dispatcher {
    constructor(config) {
        this.config = config;
    }
    
    determineMode(request) {
        if (this.config.mode === 'school' || this.config.mode === 'private') {
            return this.config.mode;
        }
        if (request && request.headers) {
            const override = request.headers['x-ar-mode'];
            if (override === 'school' || override === 'private') return override;
        }
        return 'custom';
    }
}

module.exports = Dispatcher;