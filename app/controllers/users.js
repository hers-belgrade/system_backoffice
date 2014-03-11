/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    User = mongoose.model('User'),
    dataMaster = require('./datamaster'),
    UserBase = require('hersdata').UserBase,
    _BC_ = new(require('hersdata').BigCounter)(),
    randomBytes = require('crypto').randomBytes,
    util = require('util'),
    Timeout = require('herstimeout');

/**
 * Auth callback
 */
exports.authCallback = function(req, res, next) {
    res.redirect('/');
};

/**
 * Show login form
 */
exports.signin = function(req, res) {
    res.render('users/signin', {
        title: 'Signin',
        message: req.flash('error')
    });
};

/**
 * Show sign up form
 */
exports.signup = function(req, res) {
    res.render('users/signup', {
        title: 'Sign up',
        user: new User()
    });
};

/**
 * Logout
 */
exports.signout = function(req, res) {
    req.logout();
    res.redirect('/');
};

/**
 * Session
 */
exports.session = function(req, res) {
  res.redirect('/');
};

/**
 * Create user
 */
exports.create = function(req, res) {
    var user = new User(req.body);

    user.provider = 'local';
    user.save(function(err) {
        if (err) {
            return res.render('users/signup', {
                errors: err.errors,
                user: user
            });
        }
        req.logIn(user, function(err) {
            if (err) return next(err);
            return res.redirect('/');
        });
    });
};

/**
 * Send User
 */
exports.me = function(req, res) {
    res.jsonp(req.user || null);
};

/**
 * Find user by id
 */
exports.user = function(req, res, next, id) {
    User
        .findOne({
            _id: id
        })
        .exec(function(err, user) {
            if (err) return next(err);
            if (!user) return next(new Error('Failed to load User ' + id));
            req.profile = user;
            next();
        });
};

exports.dumpData = function(req, res, next) {
  if(!req.user){
    Timeout.set(function(res){res.jsonp({});},10000,res);
    return;
  }
  req.query.name = req.user.username;
  req.query.roles = req.user.roles;
  dataMaster.functionalities.sessionuserfunctionality.f.dumpData(req.query,function(errc,errp,errm){
    if(errc==='OK'){
      res.jsonp(errp[0]);
    }else{
      res.jsonp({errorcode:errc,errorparams:errp,errormessage:errm});
    }
  });
};

exports.execute = function(req, res, next) {
  if(!req.user){
    Timeout.set(function(res){res.jsonp({});},10000,res);
    return;
  }
  req.query.name = req.user.username;
  req.query.roles = req.user.roles;
  dataMaster.functionalities.sessionuserfunctionality.f.produceAndExecute(req.query,function(errc,errp,errm){
    if(errc==='OK'){
      res.jsonp(errp[0]);
    }else{
      res.jsonp({errorcode:errc,errorparams:errp,errormessage:errm});
    }
  });
};

exports.setup = function(app){
  var io = require('socket.io').listen(app, { log: false });
  console.log('socket.io listening');
  io.set('authorization', function(handshakeData, callback){
    var username = handshakeData.query.username;
    var sess = handshakeData.query[dataMaster.functionalities.sessionuserfunctionality.f.fingerprint];
    console.log('sock.io incoming',username,sess);
    if(username && sess){
      var u = UserBase.findUser(username,dataMaster.functionalities.sessionuserfunctionality.f.realmName);
      if(!u){
        callback(null,false);
      }else{
        handshakeData.username = username;
        handshakeData.session = sess;
        callback(null,true);
      }
    }else{
      callback(null,false);
    }
  });
  io.sockets.on('connection',function(sock){
    var username = sock.handshake.username,
      session = sock.handshake.session,
      u = UserBase.findUser(username,dataMaster.functionalities.sessionuserfunctionality.f.realmName);
    //console.log(username,'sockio connected',session,'session',u.sessions);
    u.makeSession(session);
    u.sessions[session].setSocketIO(sock);
    sock.on('!',function(data){
      dataMaster.functionalities.sessionuserfunctionality.f.executeOnUser({user:u,session:session,commands:data},function(errc,errp,errm){
        console.log('sockio',arguments);
        sock.emit('=',errc==='OK' ? errp[0] : {errorcode:errc,errorparams:errp,errormessage:errm});
      });
    });
  });
};
