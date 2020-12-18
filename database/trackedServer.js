class TrackedServer {
    constructor(server_id) {
        this.server_id = server_id;
        this.channels = [];
    }

    AddChannel(channel) {
        this.channels.push(channel);
    }
    
    
}