const { EventEmitter } = require('events');

class WispServer extends EventEmitter {
    constructor() {
        super();
        this.connections = new Map();
        this.nextConnectionId = 1;
    }
    
    handleUpgrade(request, socket, head) {
        const connectionId = this.nextConnectionId++;
        
        this.connections.set(connectionId, {
            socket,
            streams: new Map(),
            nextStreamId: 1
        });
        
        socket.on('close', () => {
            this.connections.delete(connectionId);
        });
        
        socket.on('error', () => {
            this.connections.delete(connectionId);
        });
        
        return connectionId;
    }
    
    createStream(connectionId, targetHost, targetPort) {
        const connection = this.connections.get(connectionId);
        if (!connection) return null;
        
        const streamId = connection.nextStreamId++;
        
        const stream = {
            id: streamId,
            connectionId,
            targetHost,
            targetPort,
            socket: null,
            connected: false,
            dataBuffer: []
        };
        
        connection.streams.set(streamId, stream);
        
        return stream;
    }
    
    connectStream(stream) {
        const net = require('net');
        
        return new Promise((resolve, reject) => {
            stream.socket = net.connect(stream.targetPort, stream.targetHost, () => {
                stream.connected = true;
                resolve(stream);
            });
            
            stream.socket.on('data', (data) => {
                const connection = this.connections.get(stream.connectionId);
                if (connection) {
                    this.sendStreamData(connection, stream.id, data);
                }
            });
            
            stream.socket.on('close', () => {
                const connection = this.connections.get(stream.connectionId);
                if (connection) {
                    this.sendStreamClose(connection, stream.id);
                    connection.streams.delete(stream.id);
                }
            });
            
            stream.socket.on('error', reject);
        });
    }
    
    sendStreamData(connection, streamId, data) {
        connection.socket.write(this.encodePacket(streamId, data));
    }
    
    sendStreamClose(connection, streamId) {
        connection.socket.write(this.encodePacket(streamId, Buffer.alloc(0), true));
    }
    
    encodePacket(streamId, data, isClose = false) {
        const header = Buffer.alloc(5);
        header.writeUInt8(isClose ? 0x04 : 0x02, 0);
        header.writeUInt32LE(streamId, 1);
        return Buffer.concat([header, data]);
    }
}

module.exports = WispServer;