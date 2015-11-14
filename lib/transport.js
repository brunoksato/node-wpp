var net = require('net').Socket();

function Socket() {
    this.callbacks = {
        receive : null,
        error   : null,
        end     : null
    };
}

//5222, 'bin-short.whatsapp.net'
Socket.prototype.connect = function(host, port, callback, thisarg) {
    this.socket = net.connect({
        port : 443,
        host : 'e' + Math.floor(Math.random() * (15 - 1) + 1) + '.whatsapp.net'
    }, callback && callback.bind(thisarg));

    this.socket.on('error', function() {
        this.callbacks.error && this.callbacks.error.apply(this, arguments);
    }.bind(this));

    this.socket.on('end', function() {
        this.callbacks.end && this.callbacks.end.apply(this, arguments);
    }.bind(this));

    this.socket.on('data', function() {
        this.callbacks.receive && this.callbacks.receive.apply(this, arguments);
    }.bind(this));
};

Socket.prototype.send = function(data) {
    if(!this.socket) {
        throw 'Trying to send data whilst no connection established';
    }
    console.log(data.toString())
    this.socket.write(data.toString());
};

Socket.prototype.disconnect = function() {
    if(!this.socket) {
        return;
    }

    this.socket.removeAllListeners();
    this.socket.destroy();

    this.socket = null;
};

Socket.prototype.onReceive = function(callback, thisarg) {
    this.callbacks.receive = callback.bind(thisarg);
};

Socket.prototype.onError = function(callback, thisarg) {
    this.callbacks.error = callback.bind(thisarg);
};

Socket.prototype.onEnd = function(callback, thisarg) {
    this.callbacks.end = callback.bind(thisarg);
};

exports.Socket = Socket;
