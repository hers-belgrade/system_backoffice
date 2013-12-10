var mongoose = require('mongoose'),
    _ = require('underscore'),
    Server = mongoose.model('Server'),
    dataMaster = require('./datamaster');

exports.authCallback = function(req, res, next){
  
};

exports.create = function(req, res) {
  var server = new Server(req.body);

  server.save(function(err) {
      if (err) {
          return res.send(500, {
              errors: err.errors,
              server: server
          });
      } else {
          res.jsonp(server);
      }
  });
};

exports.update = function(req, res) {
  var server = req.server;

  server = _extend(server,req.body);

  server.save(function(err){
    res.jsonp(article);
  });
};
