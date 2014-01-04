/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    User = mongoose.model('User'),
    dataMaster = require('./datamaster'),
    util = require('util');


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
    if(req && req.user && req.user.name){
        dataMaster.setUser(req.user.name,'www',req.user.roles,function(user){
          if(!user){
            res.jsonp({});
            return;
          }
          var sessid = req.query[dataMaster.fingerprint];
          if(!sessid){
            sessid=~~(Math.random()*1000000);
          }
          user.makeSession(sessid);
          var session = {};
          session[dataMaster.fingerprint]=sessid;
          var _res = res;
          user.sessions[sessid].dumpQueue(function(data){
              _res.jsonp({
                  username:req.user.name,
                  roles:user.roles,
                  session:session,
                  data:data
              });
          });
        });
    }else{
        next();
    }
};

function executeOneOnUser(user,command,params,cb){
    switch(command){
      case '_':
        break;
      case 'follow':
        user.follow(params.path.slice());
        cb('OK',params.path);
        break;
      default:
        user.invoke(command,params,cb);
        break;
    }
}


function executeOnUser(user,session,commands,res){
    var sessionobj = {};
    sessionobj[dataMaster.fingerprint]=session;
    var ret = {username:user.username,roles:user.roles,session:sessionobj};
    var cmdlen = commands.length;
    var cmdstodo = cmdlen/2;
    var cmdsdone = 0;
    for (var i=0; i<cmdstodo; i++){
      var cmd = commands[i*2];
      var paramobj = commands[i*2+1];
      if(cmd.charAt(0)==='/'){
        cmd = cmd.slice(1);
      }
      executeOneOnUser(user,cmd,paramobj,(function(index,_res){
        var _i = index, __res = _res;
        return function(errcode,errparams,errmessage){
          if(!ret.results){
            ret.results=[];
          }
          ret.results[_i] = [errcode,errparams,errmessage];
          cmdsdone++;
          if(cmdsdone===cmdstodo){
            var s = user.sessions[session];
            if(!s){
              _res.jsonp({errorcode:'NO_SESSION',errorparams:[session]});
              return;
            }
            var so = {};
            so[dataMaster.fingerprint] = session;
            s.dumpQueue(function(data){
              ret.data=data;
              __res.jsonp(ret);
            },true);
          }
        };
      })(i,res));
    }
};

exports.execute = function(req, res, next) {
  //console.log(req.user,'executing');
    if(!(req.query && req.query.commands)){
      res.jsonp({});
      return;
    }
    try{
      var commands = JSON.parse(req.query.commands);
      //console.log(commands);
      if(commands.length%2){
        res.jsonp({errorcode:'invalid_command_count',errorparams:commands});
        return;
      }
      dataMaster.setUser(req.user.name,'www',req.user.roles,function(user){
        executeOnUser(user,req.query[dataMaster.fingerprint],commands,res);
      });
    }
    catch(e){
      //console.log(e.stack);
      res.jsonp({errorcode:'JSON',errorparams:[e,commands]});
    }
};
