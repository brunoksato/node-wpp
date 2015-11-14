'use strict';

var util    = require('util');
var buffer  = require('buffer');
var helpers = require('./helpers');
var Buffer  = require('buffer').Buffer;

function Node(tag, attributes, children, data) {
    this.contents = {
        tag        : tag,
        attributes : attributes || null,
        children   : children || [],
        data       : data || ''
    };
}

Node.prototype.tag = function() {
    return this.contents.tag;
};

Node.prototype.attributes = function() {
    return this.contents.attributes;
};

Node.prototype.children = function() {
    return this.contents.children;
};

Node.prototype.attribute = function(attribute) {
    return this.contents.attributes &&
           this.contents.attributes.hasOwnProperty(attribute) &&
           this.contents.attributes[attribute];
};

Node.prototype.child = function(key) {
    if(/^\d+$/.test(key)) {
        return this.contents.children.hasOwnProperty(key) && this.contents.children[key];
    }

    for(var i = 0, len = this.contents.children.length; i < len; i++) {
        if(this.contents.children[i].tag() == key) {
            return this.contents.children[i];
        }
    }

    return null;
};

Node.prototype.data = function() {
    return this.contents.data;
};

Node.prototype.shouldBeReplied = function() {
    return this.tag() === 'message'
        && (this.child('notify') || this.child('received') || this.child('request'));
};

Node.prototype.isChallenge = function() {
    return this.tag() === 'challenge';
};

Node.prototype.isSuccess = function() {
    return this.tag() === 'success';
};

Node.prototype.isTyping = function() {
    return this.tag() === 'message' && (this.contents.children[0].contents.tag === 'composing' || this.contents.children[0].contents.tag === 'paused');
};

Node.prototype.isMessage = function() {
    return this.tag() === 'message' && this.child('notify') &&
           this.child('notify').attribute('name') !== null;
};

Node.prototype.isPing = function() {
    return this.tag() === 'iq' && this.attribute('type') === 'get' && this.child(0).tag() === 'ping';
};

Node.prototype.isAvailable = function() {
    return this.tag() === 'presence' && (this.attribute('type') === 'available' || this.attribute('type') === 'unavailable');
}

Node.prototype.isDirtyPresence = function() {
    return this.tag() === 'presence' && this.attribute('status') === 'dirty';
};

Node.prototype.isMediaReady = function() {
    return this.tag() === 'iq' && this.attribute('type') === 'result' &&
           this.child(0) && ['media', 'duplicate'].indexOf(this.child(0).tag()) !== -1;
};

Node.prototype.isGroupList = function() {
    return this.tag() === 'iq' && this.attribute('type') === 'result' && this.child('group');
};

Node.prototype.isGroupAdd = function() {
    return this.tag() === 'message' && this.attribute('type') === 'subject' && this.child('body') &&
           this.child('body').attribute('event') === 'add';
};

Node.prototype.isGroupTopic = function() {
    return this.tag() === 'message' && this.attribute('type') === 'subject' && this.child('body');
};

Node.prototype.isGroupMembers = function() {
    return this.tag() === 'iq' && this.attribute('type') === 'result' && this.child(0)
        && this.child(0).tag() === 'participant' && this.child(0).attribute('xmlns') === 'w:g';
};

Node.prototype.isGroupNewcomer = function() {
    return this.tag() === 'presence' && this.attribute('xmlns') === 'w' && this.attribute('add');
};

Node.prototype.isGroupOutcomer = function() {
    return this.tag() === 'presence' && this.attribute('xmlns') === 'w' && this.attribute('remove');
};

Node.prototype.isLastSeen = function() {
    return this.child('query') && this.child('query').attribute('xmlns') === 'jabber:iq:last';
};

Node.prototype.isNotFound = function() {
    return this.tag() === 'iq' && this.child('error') &&
           this.child('error').attribute('code') === '404';
};

Node.prototype.isFailure = function() {
    return this.tag() === 'failure';
};

Node.prototype.isReceived = function() {
    return this.tag() === 'message' && this.child('received');
};

Node.prototype.isProfilePicture = function() {
    return this.tag() === 'iq' && this.child(0) && this.child(0).tag() === 'picture';
};

Node.prototype.toXml = function(prefix) {
    prefix = prefix || '';

    var xml = "\n" + prefix;

    xml += '<' + this.contents.tag;

    if(this.contents.attributes !== null) {
        for(var key in this.contents.attributes) {
            if(this.contents.attributes.hasOwnProperty(key)) {
                xml += ' ' + key + '="' + this.contents.attributes[key] + '"';
            }
        }
    }

    xml += '>';

    if(this.contents.data) {
        xml += this.contents.data;
    }

    if(this.contents.children.length) {
        this.contents.children.forEach(function(child) {
            xml += child.toXml(prefix + '  ');
        }, this);

        xml += "\n" + prefix;
    }

    xml += '</' + this.contents.tag + '>';

    return xml;
};

exports.Node   = Node;