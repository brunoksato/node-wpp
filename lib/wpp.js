'use strict';

let util        = require('util');
let events      = require('events');
let fs          = require('fs');
let crypto      = require('crypto');
let url         = require('url');
let tls         = require('tls');
let http        = require('http');
let https       = require('https');
let Buffer      = require('buffer').Buffer;
let querystring = require('querystring');
let helpers     = require('./helpers');
let constants   = require('./constants');
let transport   = require('./transport');
let encryptor   = require('./encryptor');
let Node        = require('./node').Node;
let processor   = require('./processor');
let dictionary  = require('./dictionary');

function Wpp(config, reader, writer, processor, transport) {
    this.config    = helpers.COMMON.extend({}, this.defaultConfig, config);
    this.transport = transport;
    this.reader    = reader;
    this.writer    = writer;
    this.processor = processor;

    events.EventEmitter.call(this);

    this.init();
}

util.inherits(Wpp, events.EventEmitter);

Wpp.prototype.defaultConfig = {
    msisdn         : '',
    device_id      : '',
    username       : '',
    password       : '',
    ccode          : '',
    reconnect      : false,
    host           : constants.WHATSAPP_SERVER_HOST,
    server         : constants.WHATSAPP_SERVER,
    gserver        : constants.WHATSAPP_GROUP_SERVER,
    port           : constants.WHATSAPP_PORT,
    device_type    : constants.WHATSAPP_DEVICE,
    app_version    : constants.WHATSAPP_VERSION,
    ua             : constants.WHATSAPP_USER_AGENT,
    challenge_file : __dirname + '/challenge'
};

Wpp.prototype.init = function(){
    this.transport.onReceive(this.onTransportData, this);
    this.transport.onError(this.onTransportError, this);
    this.transport.onEnd(this.onTransportEnd, this);

    this.connected   = false;
    this.challenge   = null;
    this.messageId   = 0;
    this.queue       = [];
    this.loggedIn    = false;
    this.selfAddress = helpers.JID.create(this.config.msisdn, this.config.server, this.config.gserver);
    this.processor.setAdapter(this);
}

Wpp.prototype.connect = function() {
    this.loggedIn = false;
    this.transport.connect(this.config.host, this.config.port, this.onTransportConnect, this);
};

Wpp.prototype.disconnect = function() {
    this.transport.disconnect();
};

Wpp.prototype.login = function() {
    this.reader.setKey(null);
    this.writer.setKey(null);

    var resource = [this.config.device_type, this.config.app_version, this.config.port].join('-');
    this.send(this.writer.stream(this.config.server, resource));
    this.sendNode(this.createFeaturesNode());
    this.sendNode(this.createAuthNode());

    //this.sendMessage('5512982675892', 'Test Message');
};

Wpp.prototype.flushQueue = function() {
    var queue  = this.queue;
    this.queue = [];

    queue.forEach(function(elem) {
        this.sendMessageNode(elem.to, elem.node);
    }, this);
};

Wpp.prototype.processNode = function(node) {
    console.log('processNode');
    if(node.shouldBeReplied() && node.attribute('from') !== this.selfAddress) {
        this.sendNode(this.createReceivedNode(node));
    }

    if(node.isChallenge()) {
        this.sendNode(this.createAuthResposeNode(node.data()));
        this.reader.setKey(this.readerKey);
        this.writer.setKey(this.writerKey);
        return;
    }

    if(node.isSuccess()) {
        fs.writeFile(this.config.challenge_file, node.data());
        this.loggedIn = true;
        this.flushQueue();
        console.log('login')
        return;
    }

    if(node.isAvailable()) {
        console.log('presence.available', node.attribute('from'), node.attribute('type'));
    }

    if(node.isDirtyPresence()) {
        this.sendNode(this.createClearDirtyNode(node));
        return;
    }

    if(node.isPing()) {
        this.sendNode(this.createPongNode(node.attribute('id')));
        return;
    }

    if(node.isLastSeen()) {
        var tstamp = Date.now() - (+node.child('query').attribute('seconds')) * 1000;
        console.log('lastseen.found', node.attribute('from'), new Date(tstamp));
        return;
    }

    if(node.isNotFound()) {
        console.log('lastseen.notfound', node.attribute('from'));
        return;
    }

    if(node.isFailure()) {
        console.log('error', node.toXml());
        return;
    }

    if(node.isReceived()) {
        console.log('message.delivered', node.attribute('from'), node.attribute('id'), node.attribute('t'));
        return;
    }

    if(node.isProfilePicture()) {
        var preview = node.child('picture').attribute('type') === 'preview';
        console.log('profile.picture', node.attribute('from'), preview, node.child('picture').data());
        return;
    }

    if(node.isMessage()) {
        this.processor.process(node);
    }

    if(node.isTyping()) {
        console.log('typing', node.attribute('from'), node.contents.children[0].contents.tag);
    }
};

Wpp.prototype.createClearDirtyNode = function(node) {
    var categories = [];

    if(node.children().length) {
        node.children().forEach(function(child) {
            if(child.tag() === 'category') {
                categories.push(new Node('category', {name : child.attribute('name')}));
            }
        });
    }

    var cleanNode = new Node('clean', {xmlns : 'urn:xmpp:whatsapp:dirty'}, categories);

    var attributes = {
        id   : this.nextMessageId('cleardirty'),
        type : 'set',
        to   : this.config.server
    };

    return new Node('iq', attributes, [cleanNode]);
};

Wpp.prototype.createPongNode = function(messageId) {
    var attributes = {
        to   : this.config.server,
        id   : messageId,
        type : 'result'
    };

    return new Node('iq', attributes);
};

Wpp.prototype.createReceivedNode = function(node) {
    var request  = node.child('request');
    var received = node.child('received');

    if(!request && !received) {
        return false;
    }

    var receivedNode = new Node(received ? 'ack' : 'received', {xmlns : 'urn:xmpp:receipts'});

    var attributes = {
        to   : node.attribute('from'),
        type : 'chat',
        id   : node.attribute('id'),
        t    : common.tstamp().toString()
    };

    return new Node('message', attributes, [receivedNode]);
};

Wpp.prototype.sendMessage = function(to, message, msgid) {
    this.sendMessageNode(to, new Node('body', null, null, message), msgid);
};

Wpp.prototype.sendNode = function(node) {
    node && this.send(this.writer.node(node));
};

Wpp.prototype.send = function(buffer) {
    this.transport.send(buffer);
    //this.onTransportData(buffer);
};

Wpp.prototype.sendMessageNode = function(to, node, msgid) {
    if(!this.loggedIn) {
        this.queue.push({to : to, node : node});
        return;
    }

    var serverNode  = new Node('server');
    var xNode       = new Node('x', {xmlns : 'jabber:x:event'}, [serverNode]);
    var notyAttrs   = {xmlns : 'urn:xmpp:whatsapp', name : this.config.username};
    var notifyNode  = new Node('notify', notyAttrs);
    var requestNode = new Node('request', {xmlns : 'urn:xmpp:receipts'});

    var attributes = {
        to   : helpers.JID.create(to, this.config.server, this.config.gserver),
        type : 'chat',
        id   : msgid || this.nextMessageId('message'),
        t    : helpers.COMMON.tstamp().toString()
    };

    var messageNode = new Node('message', attributes, [xNode, notifyNode, requestNode, node]);
    this.sendNode(messageNode);
};

Wpp.prototype.createFeaturesNode = function() {
    var features = [
        new Node('readreceipts'),
        new Node('groups_v2'),
        new Node('privacy'),
        new Node('presence'),
    ];

    return new Node('stream:features', null, features);
};

Wpp.prototype.createAuthNode = function() {
    var attributes = {
        //xmlns     : 'urn:ietf:params:xml:ns:xmpp-sasl',
        mechanism : 'WAUTH-2',
        user      : this.config.msisdn
    };

    return new Node('auth', attributes, null, this.createAuthData());
};

Wpp.prototype.createAuthData = function() {
    var challenge = fs.readFileSync(this.config.challenge_file);
    if(!challenge.length) {
        return '';
    }

    this.initKeys(challenge);

    this.reader.setKey(this.readerKey);

    var arr = [
        '\\u0000\\u0000\\u0000\\u0000',
        this.config.msisdn,
        challenge,
        helpers.COMMON.tstamp
    ];

    return this.writerKey.encode(arr.join(''), false);
};

Wpp.prototype.createAuthResposeNode = function(challenge) {
    this.initKeys(challenge);

    var arr = Buffer.concat([
        new Buffer(this.config.msisdn),
        challenge,
        new Buffer(common.tstamp().toString())
    ]);

    var data = this.writerKey.encode(arr, false);

    return new Node('response', {xmlns : 'urn:ietf:params:xml:ns:xmpp-sasl'}, null, data);
};

Wpp.prototype.initKeys = function(salt) {
    var key = helpers.PBKDF2.encryption(new Buffer(this.config.password, 'base64'), salt);

    this.readerKey = new encryptor(key);
    this.writerKey = new encryptor(key);
};

Wpp.prototype.onTransportConnect = function() {
    console.log('connect');
    this.login();
};

Wpp.prototype.onTransportError = function(e) {
    console.log(this.connected ? 'error' : 'connectError', e);
};

Wpp.prototype.onTransportEnd = function() {
    if(this.config.reconnect) {
        console.log('reconnect');
        this.connect();
    } else {
        console.log('end');
    }
};

Wpp.prototype.onTransportData = function(data) {
    this.reader.appendInput(data);
    while(true) {
        var node = this.reader.nextNode();
        //console.log(node)
        if(node === false) {
            break;
        }

        if(node) {
            this.processNode(node);
        }
    }
};

Wpp.prototype.nextMessageId = function(prefix) {
    return [prefix, helpers.COMMON.tstamp(), ++this.messageId].join('-');
};

module.exports = Wpp;
