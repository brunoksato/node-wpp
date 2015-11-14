'use strict';

var WppRegistration = require('./register');
// var Wpp = require('./start');

var config = {
    msisdn     : '5512982467864',//'5512982467864',
    ccode      : '55',
    sim_mcc    : '724',
    language   : 'pt',
    country    : 'BR',
    method     : 'sms'
}

var wpp = new WppRegistration(config);
//wpp.requestCode();
wpp.registerCode('819005', 'eb35d76972458fa99fac');
// wpp.registerCode('956134', 'c770e40791f7fded8a1e');
//95f7269fcf8452705870
// //
// var config = {
//     msisdn     : '5512982467864',
//     username   : '5512982467864',
//     device_id  : 'c770e40791f7fded8a1e',
//     password   : 'bb2tBTAzbmnQCuxMhcJN6Ah27J0=',
//     ccode      : '55'
// };

// // var to = '5512982675892';
// // var message = 'A Prefeitura de rio manda mensagem!';

// var adapter = Wpp(config);

// console.log(adapter.createFeaturesNode());
// console.log(adapter.createAuthNode());
// var waApi = require('./waApi').waApi;
// var wa = new waApi('5512982467864', 'bb2tBTAzbmnQCuxMhcJN6Ah27J0=', { displayName: 'Blade', debug: true });
// wa.socket.on('loggedin', function(){
//     console.log('oi')
// })

//console.log(wa.socket)
// wa.loggedin(function(err){
//     if(err) console.log(err);

//     console.log('successo');
// })
// wa.message(function(){

// })