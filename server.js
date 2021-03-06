/**
 * Module dependencies.
 */
var express = require('express')
    fs = require('fs'),
    passport = require('passport'),
    logger = require('mean-logger');/*,
    memwatch = require('memwatch'),
    util = require('util');*/


/*
memwatch.on('leak',function(info){
  console.log('memleak',info);
});
var hd;
memwatch.on('stats',function(stats){
  var newed=!hd;
  if(!hd){
    hd = new memwatch.HeapDiff();
  }
  //console.log(stats);
  if(!newed){
    var he = hd.end();
    //console.log(util.inspect(he,false,null,false));
    hd = null;
    var hec = he.change;
    if(hec.size_bytes>100000){
      console.log('!');
      var hecd = hec.details;
      for(var i in hecd){
        var hecde = hecd[i];
        if(hecde.size_bytes>50000){
          console.log(hecde);
        }
      }
    }
  }
});
*/

/**
 * Main application entry file.
 * Please note that the order of loading is important.
 */

//Load configurations
//if test env, load example file
var env = process.env.NODE_ENV = process.env.NODE_ENV || 'development',
    config = require('./config/config'),
    auth = require('./config/middlewares/authorization'),
    mongoose = require('mongoose');

//Bootstrap db connection
var db = mongoose.connect(config.db);

//Bootstrap models
var models_path = __dirname + '/app/models';
var walk = function(path) {
    fs.readdirSync(path).forEach(function(file) {
        var newPath = path + '/' + file;
        var stat = fs.statSync(newPath);
        if (stat.isFile()) {
            if (/(.*)\.(js$|coffee$)/.test(file)) {
                require(newPath);
            }
        } else if (stat.isDirectory()) {
            walk(newPath);
        }
    });
};
walk(models_path);

//bootstrap passport config
require('./config/passport')(passport);

var app = express();

//express settings
require('./config/express')(app, passport, db);

//Bootstrap routes
var server = require('http').createServer(app);
require('./config/routes')(server,app, passport, auth);

//Start the app by listening on <port>
var port = process.env.PORT || config.port;
server.listen(port);
console.log('Express app started on port ' + port);

//Initializing logger
logger.init(app, passport, mongoose);

//expose app
exports = module.exports = app;
