class StorageManager {
    constructor() { this.storage = new Map(); }
    get(sid, key) { const s = this.storage.get(sid); return s ? s.get(key) : null; }
    set(sid, key, value) {
        if (!this.storage.has(sid)) this.storage.set(sid, new Map());
        this.storage.get(sid).set(key, value);
        return true;
    }
    remove(sid, key) { const s = this.storage.get(sid); if (s) s.delete(key); }
    getAll(sid) { const s = this.storage.get(sid); if (!s) return {}; return Object.fromEntries(s); }
    import(sid, data) { this.storage.set(sid, new Map(Object.entries(data || {}))); }
}

module.exports = StorageManager;