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
  if(req && req.user && req.user.username){
    var user = dataMaster.setFollower(req.user.username,dataMaster.realmName,req.user.roles);
    user.sessionStatus = function(){
      var ret = {};
      for(var i in this.sessions){
        ret[i] = this.sessions[i].queue.length;
      }
      return ret;
    };
    user.makeSession = function(sess){
      if(!sess){
        console.trace();
        console.log('no session to make');
        process.exit(0);
      }
      if(this.sessions[sess]){return;}
      //console.log('new cs',this.followingpaths);
      var _s = new ConsumerSession(this,dataMaster,sess);
      var t = this;
      this.sessions[sess] = _s;
    };
    user.push = function(item){
      //console.log(u.username,'got',item,this.sessions);
      for(var i in this.sessions){
        this.sessions[i].push(item);
        /*
        var s = this.sessions[i];
        if(s.queue){
          if(_now-s.lastAccess>15000){
            s.destroy();
            delete this.sessions[i];
          }else{
            s.lastAccess = _now;
            if(s.sockio){
              s.sockio.emit('_',item);
            }else{
              s.queue.push(item);
            }
          }
        }else{
          //should never get here
          delete this.sessions[i];
        }
        */
      }
    };
    //console.log('recognized',user.username,user.realmname,user.keys);
    if(!user){
      res.jsonp({none:null});
      return;
    }
    var sessid = req.query[dataMaster.fingerprint];
    if(!sessid){
      _BC_.inc();
      sessid=_BC_.toString()+randomBytes(8).toString('hex');
      console.log('created',sessid,'on',user.username);
    }
    //console.log(user.sessions);
    user.makeSession(sessid);
    var session = {};
    session[dataMaster.fingerprint]=sessid;
    var _res = res;
    res.jsonp({
      username:req.user.username,
      roles:user.roles,
      session:session,
      data:user.sessions[sessid] ? user.sessions[sessid].retrieveQueue() : []
    });
    res = null;
  }else{
    console.log('dumpData with no username?');
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
              console.log('no',session,'in',user.username);
              if(_res.jsonp){
                _res.jsonp({errorcode:'NO_SESSION',errorparams:[session]});
                _res = null;
              }else{
                _res.emit('=',{errorcode:'NO_SESSION',errorparams:[session]});
              }
              return;
            }
            var so = {};
            so[dataMaster.fingerprint] = session;
            ret.data=s ? s.retrieveQueue() : [];
            if(_res.jsonp){
              _res.jsonp(ret);
              _res = null;
            }else{
              _res.emit('=',ret);
            }
          }
        };
      })(i,res));
    }
};

exports.execute = function(req, res, next) {
  //console.log(req.user,'executing');
  if(!(req.query && req.query.commands)){
    res.jsonp({none:null});
    return;
  }
  try{
    var commands = JSON.parse(req.query.commands);
    //console.log(commands);
    if(commands.length%2){
      res.jsonp({errorcode:'invalid_command_count',errorparams:commands});
      return;
    }
    var user = UserBase.setUser(req.user.username,dataMaster.realmName,req.user.roles);
    if(user){
      executeOnUser(user,req.query[dataMaster.fingerprint],commands,res);
    }else{
      res.jsonp({none:null});
      res = null;
    }
  }
  catch(e){
    //console.log(e.stack);
    res.jsonp({errorcode:'JSON',errorparams:[e,commands]});
  }
};


exports.setup = function(app){
  var io = require('socket.io').listen(app, { log: false });
  console.log('socket.io listening');
  io.set('authorization', function(handshakeData, callback){
    var username = handshakeData.query.username;
    var sess = handshakeData.query[dataMaster.fingerprint];
    console.log('sock.io incoming',username,sess);
    if(username && sess){
      var u = UserBase.findUser(username,dataMaster.realmName);
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
      u = UserBase.findUser(username,dataMaster.realmName);
    u.makeSession(session);
    u.sessions[session].setSocketIO(sock);
    sock.on('!',function(data){
      executeOnUser(u,session,data,sock);
    });
  });
};


function ConsumerSession(u,coll,session){
  this.queue = [];
  var t = this;
  u.describe(function(item){
    t.push(item);
  });
  this.user = u;
};
ConsumerSession.initTxn = JSON.stringify([JSON.stringify([]),JSON.stringify([null,'init'])]);
ConsumerSession.prototype.destroy = function(){
  for(var i in this){
    delete this[i];
  }
};
ConsumerSession.prototype.retrieveQueue = function(){
  this.lastAccess = Timeout.now();
  if(this.queue.length){
    //console.log(this.session,'splicing',this.queue);
    return this.queue.splice(0);
  }else{
    //console.log('empty q');
    return [];
  }
};
ConsumerSession.prototype.setSocketIO = function(sock){
  this.sockio = sock;
  var t = this;
  sock.on('disconnect',function(){
    delete t.sockio;
  });
  while(this.queue.length){
    //console.log('dumping q',this.queue);
    sock.emit('_',this.queue.shift());
  }
};
ConsumerSession.prototype.push = function(item){
  var _n = Timeout.now();
  if(this.sockio){
    if(_n-this.lastAccess<100){
      this.queue.push(item);
    }else{
      if(this.queue.length===0){
        this.sockio.emit('_',item);
      }else{
        this.queue.push(item);
        this.sockio.emit('_',this.queue.splice(0));
      }
    }
  }else{
    this.queue.push(item);
  }
};
