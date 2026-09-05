class RedirectHandler {
    resolve(currentUrl, location) {
        const current = new URL(currentUrl);
        
        if (location.startsWith('http://') || location.startsWith('https://')) {
            return location;
        }
        
        if (location.startsWith('//')) {
            return current.protocol + location;
        }
        
        if (location.startsWith('/')) {
            return current.protocol + '//' + current.host + location;
        }
        
        return current.protocol + '//' + current.host + current.pathname.substring(0, current.pathname.lastIndexOf('/') + 1) + location;
    }
}

module.exports = RedirectHandler;