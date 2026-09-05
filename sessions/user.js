const crypto = require('crypto');

class UserManager {
    constructor(config) {
        this.config = config;
        this.users = new Map();
        this.maxUsers = config.users?.max_users || 1000;
        this.allowRegistration = config.users?.allow_registration !== false;
    }
    
    createUser(username, password) {
        if (this.users.size >= this.maxUsers) return { error: 'Max users reached' };
        if (this.users.has(username)) return { error: 'User already exists' };
        if (!this.allowRegistration) return { error: 'Registration disabled' };
        if (!password || password.length < 8) return { error: 'Password must be 8+ characters' };
        
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = this.hashPassword(password, salt);
        
        const user = {
            username,
            salt,
            hash,
            sessions: [],
            createdAt: Date.now(),
            storageUsed: 0,
            storageLimitMB: this.config.users?.storage_limit_mb || this.config.sessions?.storage_limit_mb || 50
        };
        
        this.users.set(username, user);
        return { success: true, user };
    }
    
    authenticate(username, password) {
        const user = this.users.get(username);
        if (!user) return false;
        const hash = this.hashPassword(password, user.salt);
        return hash === user.hash;
    }
    
    getUser(username) {
        return this.users.get(username);
    }
    
    addSessionToUser(username, sessionId) {
        const user = this.users.get(username);
        if (user) {
            user.sessions.push(sessionId);
        }
    }
    
    removeSessionFromUser(username, sessionId) {
        const user = this.users.get(username);
        if (user) {
            user.sessions = user.sessions.filter(id => id !== sessionId);
        }
    }
    
    listUsers() {
        return Array.from(this.users.keys());
    }
    
    removeUser(username) {
        this.users.delete(username);
    }
    
    hashPassword(password, salt) {
        return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    }
}

module.exports = UserManager;