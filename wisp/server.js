const { EventEmitter } = require('events');
const net = require('net');

class WispServer extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map();
        this.nextId = 1;
        this.requiredSession = null;
    }
    
    setRequiredSession(sessionId) {
        this.requiredSession = sessionId;
    }
    
    handleConnection(socket) {
        const id = this.nextId++;
        const connection = { id, socket, streams: new Map() };
        this.connections.set(id, connection);
        
        socket.on('data', (data) => { try { this.processPacket(connection, data); } catch (e) {} });
        socket.on('close', () => this.cleanup(id));
        socket.on('error', () => this.cleanup(id));
        
        return id;
    }
    
    processPacket(connection, data) {
        if (data.length < 5) return;
        const type = data[0];
        const streamId = data.readUInt32LE(1);
        const payload = data.slice(5);
        
        if (type === 0x01) this.handleConnect(connection, streamId, payload);
        else if (type === 0x02) this.handleData(connection, streamId, payload);
        else if (type === 0x04) this.handleClose(connection, streamId);
    }
    
    handleConnect(connection, streamId, payload) {
        let host = ''; let port = 80;
        try {
            const str = payload.toString().trim();
            const url = new URL(str.startsWith('http') ? str : `http://${str}`);
            host = url.hostname; port = parseInt(url.port) || 80;
        } catch {
            const parts = payload.toString().trim().split(':');
            host = parts[0]; port = parseInt(parts[1]) || 80;
        }
        
        const stream = { id: streamId, socket: null };
        connection.streams.set(streamId, stream);
        
        stream.socket = net.connect(port, host, () => this.sendAck(connection, streamId));
        stream.socket.on('data', (d) => this.sendData(connection, streamId, d));
        stream.socket.on('close', () => { this.sendClose(connection, streamId); connection.streams.delete(streamId); });
        stream.socket.on('error', () => { this.sendClose(connection, streamId); connection.streams.delete(streamId); });
    }
    
    handleData(connection, streamId, payload) {
        const stream = connection.streams.get(streamId);
        if (stream && stream.socket) stream.socket.write(payload);
    }
    
    handleClose(connection, streamId) {
        const stream = connection.streams.get(streamId);
        if (stream && stream.socket) stream.socket.destroy();
        connection.streams.delete(streamId);
    }
    
    sendAck(connection, streamId) {
        const header = Buffer.alloc(5);
        header[0] = 0x03;
        header.writeUInt32LE(streamId, 1);
        connection.socket.write(header);
    }
    
    sendData(connection, streamId, data) {
        const header = Buffer.alloc(5);
        header[0] = 0x02;
        header.writeUInt32LE(streamId, 1);
        connection.socket.write(Buffer.concat([header, data]));
    }
    
    sendClose(connection, streamId) {
        const header = Buffer.alloc(5);
        header[0] = 0x04;
        header.writeUInt32LE(streamId, 1);
        connection.socket.write(header);
    }
    
    cleanup(id) {
        const connection = this.connections.get(id);
        if (connection) {
            for (const stream of connection.streams.values()) {
                if (stream.socket) stream.socket.destroy();
            }
            this.connections.delete(id);
        }
    }
}

module.exports = WispServer;