const { EventEmitter } = require('events');
const net = require('net');

class WispServer extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map();
        this.nextConnectionId = 1;
    }
    
    handleConnection(socket) {
        const connectionId = this.nextConnectionId++;
        
        this.connections.set(connectionId, {
            socket,
            streams: new Map(),
            nextStreamId: 1
        });
        
        socket.on('data', (data) => {
            this.processPacket(connectionId, data);
        });
        
        socket.on('close', () => {
            this.cleanupConnection(connectionId);
        });
        
        socket.on('error', () => {
            this.cleanupConnection(connectionId);
        });
        
        return connectionId;
    }
    
    processPacket(connectionId, data) {
        const connection = this.connections.get(connectionId);
        if (!connection) return;
        
        if (data.length < 5) return;
        
        const packetType = data[0];
        const streamId = data.readUInt32LE(1);
        
        if (packetType === 0x01) {
            this.handleConnect(connection, streamId, data.slice(5));
        } else if (packetType === 0x02) {
            this.handleData(connection, streamId, data.slice(5));
        } else if (packetType === 0x04) {
            this.handleClose(connection, streamId);
        }
    }
    
    handleConnect(connection, streamId, payload) {
        const stream = {
            id: streamId,
            connectionId: connection.id,
            socket: null,
            connected: false
        };
        
        connection.streams.set(streamId, stream);
    }
    
    handleData(connection, streamId, payload) {
        const stream = connection.streams.get(streamId);
        if (stream && stream.socket && stream.connected) {
            stream.socket.write(payload);
        }
    }
    
    handleClose(connection, streamId) {
        const stream = connection.streams.get(streamId);
        if (stream) {
            if (stream.socket) {
                stream.socket.destroy();
            }
            connection.streams.delete(streamId);
        }
    }
    
    cleanupConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (connection) {
            for (const stream of connection.streams.values()) {
                if (stream.socket) {
                    stream.socket.destroy();
                }
            }
            this.connections.delete(connectionId);
        }
    }
    
    sendPacket(connection, streamId, packetType, data) {
        if (!connection || !connection.socket) return;
        
        const header = Buffer.alloc(5);
        header[0] = packetType;
        header.writeUInt32LE(streamId, 1);
        
        const packet = Buffer.concat([header, data]);
        connection.socket.write(packet);
    }
    
    sendData(connection, streamId, data) {
        this.sendPacket(connection, streamId, 0x02, data);
    }
    
    sendClose(connection, streamId) {
        this.sendPacket(connection, streamId, 0x04, Buffer.alloc(0));
    }
}

module.exports = WispServer;