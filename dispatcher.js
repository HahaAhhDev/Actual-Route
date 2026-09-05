class Dispatcher {
    constructor(config) {
        this.config = config;
    }

    determineMode(request) {
        if (this.config.mode === 'school' || this.config.mode === 'private') {
            return this.config.mode;
        }

        if (request && request.headers && request.headers['x-ar-mode']) {
            const mode = request.headers['x-ar-mode'];
            if (mode === 'school' || mode === 'private') {
                return mode;
            }
        }

        return 'custom';
    }
}

module.exports = Dispatcher;