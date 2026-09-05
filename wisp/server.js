const { EventEmitter } = require('events');
const net = require('net');

const MAX_STREAMS_PER_CONNECTION = 100;

class WispServer extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map();
        this.nextConnectionId = 1;
    }
    
    handleConnection(socket) {
        const connectionId = this.nextConnectionId++;
        const connection = {
            id: connectionId,
            socket,
            streams: new Map(),
            nextStreamId: 1
        };
        this.connections.set(connectionId, connection);
        
        socket.on('data', (data) => {
            try { this.processPacket(connection, data); } catch (e) {}
        });
        
        socket.on('close', () => this.cleanupConnection(connectionId));
        socket.on('error', () => this.cleanupConnection(connectionId));
        
        return connectionId;
    }
    
    processPacket(connection, data) {
        if (!data || data.length < 5) return;
        const packetType = data[0];
        const streamId = data.readUInt32LE(1);
        const payload = data.slice(5);
        
        if (packetType === 0x01) this.handleConnect(connection, streamId, payload);
        else if (packetType === 0x02) this.handleData(connection, streamId, payload);
        else if (packetType === 0x04) this.handleClose(connection, streamId);
    }
    
    handleConnect(connection, streamId, payload) {
        if (connection.streams.size >= MAX_STREAMS_PER_CONNECTION) {
            this.sendClose(connection, streamId);
            return;
        }
        
        let targetHost = '';
        let targetPort = 80;
        
        try {
            const payloadStr = payload.toString('utf-8').trim();
            const urlObj = new URL(payloadStr.startsWith('http') ? payloadStr : `http://${payloadStr}`);
            targetHost = urlObj.hostname;
            targetPort = parseInt(urlObj.port) || 80;
        } catch {
            const parts = payload.toString('utf-8').trim().split(':');
            targetHost = parts[0];
            targetPort = parseInt(parts[1]) || 80;
        }
        
        const stream = { id: streamId, connectionId: connection.id, socket: null, connected: false };
        connection.streams.set(streamId, stream);
        
        stream.socket = net.connect(targetPort, targetHost, () => {
            stream.connected = true;
            this.sendConnectAck(connection, streamId);
        });
        
        stream.socket.on('data', (data) => this.sendData(connection, streamId, data));
        stream.socket.on('close', () => {
            this.sendClose(connection, streamId);
            connection.streams.delete(streamId);
        });
        stream.socket.on('error', () => {
            this.sendClose(connection, streamId);
            connection.streams.delete(streamId);
        });
    }
    
    handleData(connection, streamId, payload) {
        const stream = connection.streams.get(streamId);
        if (stream && stream.socket && stream.connected) stream.socket.write(payload);
    }
    
    handleClose(connection, streamId) {
        const stream = connection.streams.get(streamId);
        if (stream) {
            if (stream.socket) stream.socket.destroy();
            connection.streams.delete(streamId);
        }
    }
    
    sendConnectAck(connection, streamId) {
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
    
    cleanupConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (connection) {
            for (const stream of connection.streams.values()) {
                if (stream.socket) stream.socket.destroy();
            }
            this.connections.delete(connectionId);
        }
    }
}

module.exports = WispServer;
