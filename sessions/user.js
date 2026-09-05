const crypto = require('crypto');

class UserManager {
    constructor(config) {
        this.config = config;
        this.users = new Map();
        this.sessions = new Map();
        this.maxUsers = config.users?.max_users || 1000;
        this.allowRegistration = config.users?.allow_registration !== false;
        this.requireLogin = config.users?.require_login || false;
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
    
    login(username, password) {
        if (!this.authenticate(username, password)) {
            return { error: 'Invalid credentials' };
        }
        
        const user = this.users.get(username);
        const sessionToken = crypto.randomBytes(32).toString('hex');
        
        this.sessions.set(sessionToken, {
            username,
            createdAt: Date.now(),
            expiresAt: Date.now() + (this.config.sessions?.default_ttl_hours || 24) * 3600 * 1000
        });
        
        return { success: true, token: sessionToken, user };
    }
    
    logout(token) {
        this.sessions.delete(token);
    }
    
    getUserByToken(token) {
        const session = this.sessions.get(token);
        if (!session) return null;
        
        if (Date.now() > session.expiresAt) {
            this.sessions.delete(token);
            return null;
        }
        
        return this.users.get(session.username);
    }
    
    createSessionForUser(username, sessionId) {
        const user = this.users.get(username);
        if (!user) return false;
        user.sessions.push(sessionId);
        return true;
    }
    
    getUserSessions(username) {
        const user = this.users.get(username);
        return user ? user.sessions : [];
    }
    
    deleteSessionFromUser(username, sessionId) {
        const user = this.users.get(username);
        if (!user) return false;
        user.sessions = user.sessions.filter(id => id !== sessionId);
        return true;
    }
    
    getUser(username) {
        return this.users.get(username);
    }
    
    listUsers() {
        return Array.from(this.users.keys());
    }
    
    hashPassword(password, salt) {
        return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    }
    
    removeUser(username) {
        const user = this.users.get(username);
        if (user) {
            for (const token of this.sessions.keys()) {
                if (this.sessions.get(token).username === username) {
                    this.sessions.delete(token);
                }
            }
        }
        this.users.delete(username);
    }
}

module.exports = UserManager;