'use strict';

let Wpp         = require('./wpp');
let transports  = require('./transport');
let encryptor   = require('./encryptor');
let Writer      = require('./writer').Writer;
let Reader      = require('./reader').Reader;
let processors  = require('./processor');
let dictionary  = require('./dictionary');

function Start(config, reader, writer, processor, transport) {
    reader    = reader    || new Reader(dictionary);
    writer    = writer    || new Writer(dictionary);
    processor = processor || processors.createProcessor();
    transport = transport || new transports.Socket;

    return new Wpp(config, reader, writer, processor, transport);
}

module.exports = Start;