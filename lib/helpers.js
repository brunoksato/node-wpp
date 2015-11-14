var url    = require('url');
var http   = require('http');
var https  = require('https');
var crypto = require('crypto');

exports.COMMON = {
  tstamp: function() {
    return Math.floor(Date.now() / 1000);
  },
  objSize: function(buff) {
    var size = 0;

    for(var key in buff) {
        if(buff.hasOwnProperty(key)) {
            ++size;
        }
    }

    return size;
  },
  toArray: function(iterable){
    var arr = [];

    for(var i = 0, len = iterable.length; i < len; i++) {
        arr.push(iterable[i]);
    }

    return arr;
  },
  extend: function(){
    var args   = this.toArray(arguments),
        target = args.shift();

    for(var i = 0, len = args.length, source; i < len; i++) {
        source = args[i];

        for(var key in source) {
            if(source.hasOwnProperty(key)) {
                target[key] = source[key];
            }
        }
    }

    return target;
  },
  fetch: function(target, callback){
    var protocol = url.parse(target).protocol === 'https:' ? https : http;

    protocol.get(target, function(res) {
        var buffers = [];

        res.on('data', function(buf) {
            buffers.push(buf);
        });

        res.on('end', function() {
            callback(false, Buffer.concat(buffers));
        });
    }).on('error', function(e) {
        callback(e);
    });
  }
};

exports.PBKDF2 = {
  encryption: function(password, salt, iterations, length) {
    iterations = iterations || 16;
    length     = length || 20;

    return crypto.pbkdf2Sync(password, salt, iterations, length);
  }
}

exports.IDENTITY = {
  generate : function(){
    var len = 20;
    return crypto.randomBytes(Math.ceil(len/2))
        .toString('hex')
        .slice(0,len);
  }
}

exports.JID = {
  create: function(msisdn, server, gserver){
    if(msisdn.indexOf('@') !== -1) {
      return msisdn;
    }

    var affix = msisdn.indexOf('-') === -1 ? server : gserver;

    return msisdn + '@' + affix;
  }
};