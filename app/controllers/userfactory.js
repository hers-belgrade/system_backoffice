var hersdata = require('hersdata'),
  SessionUser = hersdata.SessionUser,
  Broadcaster = hersdata.Broadcaster,
  AutoBroadcaster = hersdata.AutoBroadcaster,
  BroadcastingChannel = hersdata.BroadcastingChannel;

var _StatsBcaster,_ServersBcaster;

function initBcasters(data){
  if(!_StatsBcaster){
    _StatsBcaster = new AutoBroadcaster(data.elementRaw('stats'),function(){},'statsbcaster','_central','dcp',3);
    _StatsBcaster.createTranslator('stats',['stats'],0);
  }
  if(!_ServersBcaster){
    _ServersBcaster = new AutoBroadcaster(data.elementRaw('stats'),function(){},'statsbcaster','_central','dcp',3);
    _ServersBcaster.createTranslator('stats',['stats'],0);
  }
}

function Admin(data,username,realmname,roles,cb){
  initBcasters(data);
  SessionUser.call(this,data,username,realmname,roles,cb);
  this.channels = {};
  this.channels.stats = new BroadcastingChannel(this);
  this.channels.stats.switchTo(_StatsBcaster,'stats');
  this.channels.stats.activate();
}
Admin.prototype = Object.create(SessionUser.prototype,{constructor:{
  value:Admin,
  enumerable:false,
  writable:false,
  configurable:false
}});
Admin.prototype.describe = function(cb){
  for(var i in this.channels){
    this.channels[i].describe(cb);
  }
};

function userFactory(data,username,realmname,roles,cb){
  cb(new Admin(data,username,realmname,roles));
}

module.exports = {
  _produceUser:userFactory
};
