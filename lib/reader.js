'use strict';

var util    = require('util');
var buffer  = require('buffer');
var helpers = require('./helpers');
var Buffer  = require('buffer').Buffer;

function Reader(dictionary) {
    this.dictionary = dictionary;
    this.setKey(null);
    this.input = null;
}

Reader.prototype.setKey = function(key) {
    this.key = key;
};

Reader.prototype.appendInput = function(input) {
    var buff = new Buffer(input.length);
    input = buff;

    if (this.input instanceof Buffer) {
        var buffers = [this.input, input];
        var len = this.input.length + input.length;

        if(!len) {
            len = 0;

            buffers.forEach(function(buffer) {
                len += buffer.length;
            });
        }

        var result = new Buffer(len);
        var offset = 0;

        buffers.forEach(function(buffer) {
            buffer.copy(result, offset);

            offset += buffer.length;
        });

        this.input = result;
    } else {
        this.input = input;
    }
};

Reader.prototype.nextNode = function() {
    if(!this.input || !this.input.length) {
        return false;
    }

    var encrypted = ((this.peekInt8() & 0xF0) >> 4) & 8;
    var dataSize  = this.peekInt16(1);
    if(dataSize > this.input.length) {
        return false;
    }

    this.readInt24();

    if(encrypted) {
        if(this.key === null) {
            throw 'Encountered encrypted message, missing key';
        }

        var encoded = new buffer.Buffer(dataSize);

        this.input.copy(encoded, 0, 0, dataSize);

        var remaining = this.input.slice(dataSize);
        var decoded   = this.key.decode(encoded);

        this.input = Buffer.concat([decoded, remaining]);
    }

    return dataSize ? this.readNode() : null;
};

Reader.prototype.readNode = function() {
    var listSize = this.readListSize(this.readInt8());
    var token    = this.readInt8();

    if(token === 1) {
        return new Node('start', this.readAttributes(listSize));
    }

    if(token === 2) {
        return null;
    }

    var tag = this.readString(token);
    var attributes = this.readAttributes(listSize);

    if(listSize % 2 === 1) {
        return new Node(tag, attributes);
    }

    token = this.readInt8();

    var children;
    var data;

    this.isListToken(token) ? children = this.readList(token) : data = this.readString(token, true);

    return new Node(tag, attributes, children, data);
};

Reader.prototype.getToken = function(token) {
    if(this.dictionary.hasOwnProperty(token)) {
        return this.dictionary[token];
    }

    throw 'Unexpected token: ' + token;
};

Reader.prototype.readString = function(token, raw) {
    if(token === -1) {
        throw 'Invalid token';
    }

    if(token > 4 && token < 0xF5) {
        return this.getToken(token);
    }

    if(token === 0xFC) {
        return this.fillArray(this.readInt8(), raw);
    }

    if(token === 0xFD) {
        return this.fillArray(this.readInt24(), raw);
    }

    if(token === 0xFE) {
        return this.getToken(this.readInt8() + 0xF5);
    }

    if(token === 0xFA) {
        var user   = this.readString(this.readInt8());
        var server = this.readString(this.readInt8());

        return user.length ? user + '@' + server : server;
    }

    return '';
};

Reader.prototype.readAttributes = function(size) {
    var len = (size - 2 + size % 2) / 2;
    var attributes = {};

    while(len--) {
        var key = this.readString(this.readInt8());

        attributes[key] = this.readString(this.readInt8());
    }

    return attributes;
};

Reader.prototype.isListToken = function(token) {
    return [0, 0xF8, 0xF9].indexOf(token) !== -1;
};

Reader.prototype.readListSize = function(token) {
    if(token === 0xF8) {
        return this.readInt8();
    }

    if(token === 0xF9) {
        return this.readInt16();
    }

    throw 'Invalid token: ' + token;
};

Reader.prototype.readList = function(token) {
    var size = this.readListSize(token);
    var list = [];

    while(size--) {
        list.push(this.readNode());
    }

    return list;
};

Reader.prototype.fillArray = function(len, raw) {
    try {
        return raw ? this.input.slice(0, len).toBuffer() : this.input.toString(null, 0, len);
    } finally {
        this.input = this.input.slice(len);
    }
};

Reader.prototype.peekInt8 = function(offset) {
    offset = offset || 0;

    return this.input.readUInt8(offset);
};

Reader.prototype.readInt8 = function() {
    try {
        return this.peekInt8();
    } finally {
        this.input = this.input.slice(1);
    }
};

Reader.prototype.peekInt16 = function(offset) {
    offset = offset || 0;

    return this.input.readUInt16BE(offset);
};

Reader.prototype.readInt16 = function() {
    try {
        return this.peekInt16();
    } finally {
        this.input = this.input.slice(2);
    }
};

Reader.prototype.peekInt24 = function(offset) {
    offset = offset || 0;

    return this.input.readUInt24BE(offset);
};

Reader.prototype.readInt24 = function() {
    try {
        return this.peekInt24();
    } finally {
        this.input = this.input.slice(3);
    }
};

exports.Reader = Reader;