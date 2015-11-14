'use strict';

var util    = require('util');
var buffer  = require('buffer');
var helpers = require('./helpers');
var Buffer  = require('buffer').Buffer;

function Writer(dictionary) {
    this.dictionary = {};

    dictionary.forEach(function(token, index) {
        this.dictionary[token] = index;
    }, this);

    this.setKey(null);
}

Writer.prototype.setKey = function(key) {
    this.key = key;
};

Writer.prototype.initBuffer = function(len) {
    this.output = new Buffer(len);
    this.offset = 0;
};

Writer.prototype.stream = function(to, resource) {
    var header = new Buffer(5);
    header.write('WA');
    header.writeUInt8(1, 2);
    header.writeUInt8(5, 3);

    var attributes = {to : to, resource : resource};

    this.initBuffer(3 + this.getAttributesBufferLength(attributes));
    this.writeListStart(5);
    this.writeInt8(0x01);
    this.writeAttributes(attributes);

    var output = this.flush();

    var nodebuffer = new buffer.Buffer(Buffer.concat([header, output], header.length + output.length));
    return nodebuffer;
};

Writer.prototype.node = function(node) {
    if(node === null) {
        this.initBuffer(1);
        this.writeInt8(0x00);
    } else {
        this.initBuffer(this.getNodeBufferLength(node));
        this.writeNode(node);
    }
    var nodebuffer = new buffer.Buffer(this.flush())
    return nodebuffer;
};

Writer.prototype.flush = function() {
    var nodebuffer = new buffer.Buffer(this.output.length);
    var output = nodebuffer;

    if(this.key !== null) {
        output = this.key.encode(output);
    }

    var header = new Buffer(3);

    header.writeUInt8(this.key === null ? 0x00 : 0x10, 0);
    header.writeUInt16BE(output.length, 1);

    try {
        return Buffer.concat([header, output], header.length + output.length);
    } finally {
        this.output = null;
    }
};

Writer.prototype.writeNode = function(node) {
    var len = 1;

    if(node.attributes() !== null) {
        len += helpers.COMMON.objSize(node.attributes()) * 2;
    }

    if(node.children().length) {
        ++len;
    }

    if(node.data().length) {
        ++len;
    }

    this.writeListStart(len);
    this.writeString(node.tag());
    this.writeAttributes(node.attributes());

    if(node.data().length) {
        this.writeBytes(node.data());
    }

    if(node.children().length) {
        this.writeListStart(node.children().length);

        node.children().forEach(function(node) {
            this.writeNode(node);
        }, this);
    }
};

Writer.prototype.writeListStart = function(len) {
    if(len === 0) {
        this.writeInt8(0x00);
    }

    if(len < 0x100) {
        this.writeInt8(0xF8);
    } else {
        this.writeInt8(0xF9);
    }

    this.writeInt8(len);
};

Writer.prototype.writeAttributes = function(attributes) {
    if(attributes === null) {
        return;
    }

    for(var key in attributes) {
        if(attributes.hasOwnProperty(key)) {
            this.writeString(key);
            this.writeString(attributes[key]);
        }
    }
};

Writer.prototype.writeString = function(string) {
    if(this.dictionary.hasOwnProperty(string)) {
        return this.writeToken(this.dictionary[string]);
    }

    var index = string.indexOf('@');

    if(index !== -1) {
        var user   = string.slice(0, index);
        var server = string.slice(index + 1);
        return this.writeJid(user, server);
    }

    return this.writeBytes(string);
};

Writer.prototype.writeToken = function(token) {
    if(token < 0xF5) {
        return this.writeInt8(token);
    }

    if(token < 0x1F5) {
        this.writeInt8(0xFE);
        this.writeInt8(token - 0xF5);
    }

    return true;
};

Writer.prototype.writeJid = function(user, server) {
    this.writeInt8(0xFA);

    if(user.length) {
        this.writeString(user);
    } else {
        this.writeToken(0);
    }

    this.writeString(server);
};

Writer.prototype.writeBytes = function(bytes) {
    var len = bytes.length;

    if(len >= 0x100) {
        this.writeInt8(0xFD);
        this.writeInt24(len);
    } else {
        this.writeInt8(0xFC);
        this.writeInt8(len);
    }

    if(bytes instanceof buffer.Buffer) {
        bytes.copy(this.output, this.offset);
    } else {
        this.output.write(bytes, this.offset);
    }


    this.offset += len;
};

Writer.prototype.writeInt8 = function(uint) {
    this.output.writeUInt8(uint, this.offset++);
};

Writer.prototype.writeInt16 = function(uint) {
    this.output.writeUInt16BE(uint, this.offset);
    this.offset += 2;
};

Writer.prototype.writeInt24 = function(uint) {
    this.output.writeUInt24BE(uint, this.offset);
    this.offset += 3;
};


Writer.prototype.getNodeBufferLength = function(node) {
    var size = 2;

    size += this.getStringBufferLength(node.tag());

    if(node.attributes() !== null) {
        size += this.getAttributesBufferLength(node.attributes());
    }

    if(node.data() !== '') {
        size += this.getRawBufferLength(node.data());
    }

    if(node.children().length) {
        size += 2;

        node.children().forEach(function(child) {
            size += this.getNodeBufferLength(child);
        }, this);
    }

    return size;
};

Writer.prototype.getStringBufferLength = function(string) {
    if(this.dictionary.hasOwnProperty(string)) {
        return this.getTokenBufferLength(this.dictionary[string]);
    }

    if(string.indexOf('@') != -1) {
        var parts   = string.split('@');
        var jidsize = 1;

        jidsize += parts[0].length
            ? this.getStringBufferLength(parts[0])
            : this.getTokenBufferLength(0);

        jidsize += this.getStringBufferLength(parts[1]);

        return jidsize;
    }

    return this.getRawBufferLength(string);
};

Writer.prototype.getTokenBufferLength = function(token) {
    if(token < 0xF5) {
        return 1;
    }

    if(token < 0x1F5) {
        return 2;
    }

    return 0;
};

Writer.prototype.getAttributesBufferLength = function(attributes) {
    var size = 0;

    for(var key in attributes) {
        if(attributes.hasOwnProperty(key)) {
            size += this.getStringBufferLength(key) + this.getStringBufferLength(attributes[key]);
        }
    }

    return size;
};

Writer.prototype.getRawBufferLength = function(raw) {
    var size = raw.length + 2;

    return raw.length >= 0x100 ? size + 2 : size;
};

exports.Writer = Writer;
