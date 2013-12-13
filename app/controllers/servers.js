var mongoose = require('mongoose'),
    _ = require('underscore'),
    Server = mongoose.model('Server'),
    dataMaster = require('./datamaster');

dataMaster.commit('servers_init',[
  ['set',['cluster_interface'],'dcp'],
  ['set',['cluster'],'dcp']
]);

exports.authCallback = function(req, res, next){
  console.log(req.user);
  var servname = req.user.name;
  var replicationport = req.query.replicationport;
  console.log(servname,'replicating on',replicationport);
  var servel = dataMaster.element(['cluster',servname]);
  if(!servel){
    dataMaster.commit('new_server',[
      ['set',['cluster_interface',servname],servname]
    ]);
    dataMaster.element(['cluster']).createRemoteReplica(servname,'dcp',{host:req._remoteAddress,port:replicationport});
  }
  dataMaster.setUser(servname,'dcp',['dcp',servname].join(','));
  res.jsonp({name:servname,replicationPort:dataMaster.replicationPort});
};

exports.save = function(req, res) {
  var s = new Server(req.body);
  var so = s.toObject();
  delete so.name;
  Server.findOneAndUpdate({name:req.body.name},so,{upsert:true,new:true},function(err,server){
    console.log(err,server);
    res.jsonp({name:server});
  });
};

exports.all = function(req,res) {
  Server.find({},function(err,srvs){
    res.jsonp(srvs);
  });
};
