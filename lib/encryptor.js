'use strict'

var crypto = require('crypto');

function KeyStream(key, drop) {
    this.cipher = crypto.createCipheriv('rc4', key, new Buffer(''));
    this.key    = key;

    drop = drop || 256;

    var buffer = new Buffer(drop);

    for(var i = 0; i < drop; i++) {
        buffer.writeUInt8(i, i);
    }

    this.cipher.update(buffer);
}

KeyStream.prototype.encode = function(data, append) {
    if(append !== false) {
        append = true;
    }

    var hash  = this.cipher.update(data),
        hmac  = crypto.createHmac('sha1', this.key).update(hash).digest(),
        affix = hmac.slice(0, 4);

    var buffers = append ? [hash, affix] : [affix, hash];

    return Buffer.concat(buffers, affix.length + hash.length);
};

KeyStream.prototype.decode = function(data) {
    return this.cipher.update(data.slice(4)).slice();
};

module.exports = KeyStream;