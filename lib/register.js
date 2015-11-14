'use strict';

let crypto      = require('crypto');
let url         = require('url');
let tls         = require('tls');
let https       = require('https');
let querystring = require('querystring');
let helpers     = require('./helpers');
let constants   = require('./constants');

class WppRegistration {
    constructor(config) {
        this.config = helpers.COMMON.extend({}, this.defaultConfig, config);
    }

    defaultConfig() {
        return {
            msisdn     : '',
            ccode      : '',
            language   : '',
            country    : ''
        }
    }

    requestCode() {
        let regex = new RegExp('^' + this.config.ccode + '(\\d+)$')
        let match = this.config.msisdn.match(regex);

        if(!match) {
            console.error('error', 'Invalid msisdn provided');
            return;
        }

        let token = this.generateToken(match[1]);

        let params = {
            lg         : this.config.language,
            lc         : this.config.country,
            method     : this.config.method,
            sim_mcc    : this.config.sim_mcc,
            sim_mnc    : '000',
            token      : token
        };

        this.request('code', params, function(response, source) {
            if(response.status === 'sent') {
                console.log('code.sent', this.config.msisdn);
                return;
            }

            if(response.reason === 'too_recent') {
                console.log('code.wait', this.config.msisdn, response.retry_after)
                return;
            }

            console.error('error', 'Code request error: ' + source);
        }.bind(this));
    }

    registerCode(code, id) {
        let params = {
            code : code,
            id: id
        };

        this.request('register', params, function(response, source) {
            console.error('error', 'Code registration failed: ' + source);
        });
    }

    request(method, queryParams, callback) {
        let regex = new RegExp('^' + this.config.ccode + '(\\d+)$')
        let match = this.config.msisdn.match(regex);

        if(!match) {
            console.error('error', 'Invalid msisdn provided');
            return;
        }

        let query = {
            cc : this.config.ccode,
            in : match[1],
            id : queryParams.id !== undefined ? queryParams.id : helpers.IDENTITY.generate()
        };

        if(queryParams instanceof Function) {
            callback = queryParams;
        } else {
            helpers.COMMON.extend(query, queryParams);
        }

        var url = {
            hostname : constants.WHATSAPP_HOST,
            path     : constants.WHATSAPP_HOST_VERSION + method + '?' + querystring.stringify(query),
            headers  : {
                'User-Agent' : constants.WHATSAPP_USER_AGENT,
                'Accept'     : 'text/json'
            }
        };

        console.log(url)

        let req = https.get(url, function(res) {
            let buffers = [];

            res.on('data', function(buf) {
                buffers.push(buf);
            });

            res.on('end', function() {
                let jsonbody = Buffer.concat(buffers).toString();
                let response;

                try {
                    response = JSON.parse(jsonbody);
                } catch(e) {
                    console.error('error', 'Non-json response: ' + response);
                    return;
                }

                if(response.status !== 'ok') {
                    callback(response, jsonbody);
                    return;
                }

                response = {
                    msisdn: this.config.msisdn,
                    login: response.login,
                    pw: response.pw,
                    type: response.type,
                    expiration: response.expiration,
                    kind: response.kind,
                    price: response.price,
                    cost: response.cost,
                    currency: response.currency,
                    price_expiration: response.price_expiration
                };

                console.log(response);

                return response;

            }.bind(this));
        }.bind(this));

        req.on('error', function(e) {
            console.error(e);
        }.bind(this));
    }

    generateToken(msisdn) {
        let key          = constants.TOKEN_KEY;
        let releaseTime  = constants.TOKEN_RELEASE_TIME;
        let shasum       = crypto.createHash('md5');
        shasum.update(key + releaseTime + msisdn);
        return shasum.digest('hex');
    }
}

module.exports = WppRegistration;