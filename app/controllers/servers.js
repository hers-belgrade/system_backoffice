var mongoose = require('mongoose'),
    _ = require('underscore'),
    Server = mongoose.model('Server'),
    dataMaster = require('./datamaster'),
    hersdata = require('hersdata');

dataMaster.commit('servers_init',[
  ['set',['cluster_interface'],'dcp'],
  ['set',['cluster']],
  ['set',['cluster','realms'],'dcp'],
  ['set',['cluster','nodes']]
]);

var portMap = {};

function ReplicateServer(type,servname,servaddress){
  console.log('ReplicateServer',type,servname,servaddress);
  var actions = [], replicationport=portMap[servaddress];
  var servcontel = dataMaster.element(['cluster',type,servname]);
  if(!servcontel){
    actions.push(['set',['cluster',type,servname]]);
  }else{
    var servstatusel = servcontel.element(['status']);
    if(servstatusel){
      console.log('how come there is a status on',servname,'?');
    }
  }
  actions.push(
    ['set',['cluster',type,servname,'address'],[servaddress,undefined,'dcp']],
    ['set',['cluster_interface',servname],servname],
    ['set',['cluster_interface',servname,'replicationPort'],[replicationport,undefined,'dcp']]
  );
  dataMaster.commit('new_server',actions);
  servcontel = dataMaster.element(['cluster',type,servname]);
  servcontel.createRemoteReplica('server','dcp','dcp',{address:servaddress,port:replicationport});
  servcontel.element(['server']).userFactory = {create:function(data,username,realmname,roles){
    console.log(servname,'creates a new user',username,realmname);
    var ret = new hersdata.KeyRing(data,username,realmname,roles);
    ret.newKey.attach(function(key){
      //console.log('dataMaster should setKey',username,realmname,key);
      dataMaster.setKey(username,realmname,key);
    });
    ret.keyRemoved.attach(function(key){
      //console.log('dataMaster should removeKey',username,realmname,key);
      dataMaster.removeKey(username,realmname,key);
    });
    return ret;
  }};
  var servel = dataMaster.element(['cluster',type,servname,'server']);
  servel.go(function(status){
    //console.log(servname,status);
    servcontel.commit('status_change',[
      ['set',['status'],[status,undefined,'dcp']]
    ]);
    //console.log(servname,status,servcontel.dataDebug());
  });
};

function portAvailableOn(servaddress){
};

var portAvailability = function(el,name,searchobj){
  console.log('checking',el.dataDebug());
  var servaddress = searchobj.servaddress;
  var st = el.element(['status']);
  if(st){
    if(st.value()==='connected'){
      return false;
    }else{
      var addr = el.element(['address']);
      if(addr&&addr.value()!==servaddress){
        return false;
      }
      return true;
    }
  }
  console.log(el.dataDebug(),'has no status',portMap[servaddress]);
  portMap[servaddress]++;
  ReplicateServer(searchobj.type,name,servaddress);
  return true;
};

exports.authCallback = function(req, res, next){
  if(!portMap[req.connection.remoteAddress]){
    portMap[req.connection.remoteAddress] = 16100;
  };
  var servname = req.user.name;
  var servdomain = req.user.domain;
  var realmtemplatename = servname+'Realm';
  dataMaster.invoke('dcpregistry/registerTemplate',{templateName:realmtemplatename,registryelementpath:['cluster','realms'],availabilityfunc:portAvailability});
  dataMaster.invoke('dcpregistry/newNameForTemplate',{templateName:realmtemplatename,type:'realms',servaddress:req.connection.remoteAddress},'backoffice','dcp','dcp',function(errcode,errparams){
    if(errcode==='OK'){
      var servname = errparams[0];
      console.log(servname,'should be logged in');
      res.jsonp({name:servname,domain:servdomain,replicationPort:dataMaster.replicationPort});
    }
  });
};

exports.save = function(req, res) {
  var s = new Server(req.body);
  var so = s.toObject();
  delete so._id;
  delete so.name;
  Server.findOneAndUpdate({name:req.body.name},so,{upsert:true,new:true},function(err,server){
    console.log(err,server,so);
    res.jsonp({name:server});
  });
};

exports.all = function(req,res) {
  Server.find({},function(err,srvs){
    res.jsonp(srvs);
  });
};

function findAndEngage(type,servreplica,autocreate){
  var servname = servreplica.replicaToken.name;
  var servaddress = servreplica.socket.remoteAddress;
  //console.log('finding',servname,servaddress,'to engage with autocreate',autocreate);
  if(!portMap[servaddress]){
    portMap[servaddress]=16100;
  }
  var servcontel = dataMaster.element(['cluster',type,servname]);
  if(servcontel){
    console.log(servname,'found');
    servreplica.replicaToken.type=type;
    if(!servcontel.element(['status'])){
      //console.log('replica',type,servname,'logged in');
      portMap[servaddress]++;
      ReplicateServer(type,servname,servaddress);
      //console.log(servname,'engaged');
      return true;
    }
  }else if(autocreate){
    //console.log('autocreating');
    servcontel = dataMaster.commit('new_server',[
      ['set',['cluster',type,servname]]
    ]);
    //console.log('replica',type,servname,'ressurected');
    portMap[servaddress]++;
    ReplicateServer(type,servname,servaddress);
    return true;
  }
};

dataMaster.newReplica.attach(function(servreplica){
  console.log('incoming replica',servreplica.replicaToken);
  var reptype = servreplica.replicaToken.type;
  if(reptype){
    findAndEngage(reptype,servreplica,true);
  }else{
    if(!findAndEngage('realms',servreplica)){
      if(!findAndEngage('nodes',servreplica)){
        //console.log(servreplica.replicaToken,'could not be engaged');
      }
    }
  }
  console.log('replica processed',servreplica.replicaToken);
  return;
  /*
  var servel = dataMaster.element(['cluster',servname]);
  if(!servel){
    dataMaster.commit('server_accepted',[
      ['set',['cluster',servname],'dcp'],
      [
    ]);
  }
  */
});

exports.accept = function(req,res) {
  if(!portMap[req.connection.remoteAddress]){
    portMap[req.connection.remoteAddress] = 16100;
  };
  dataMaster.invoke('dcpregistry/registerTemplate',{templateName:'DCPNode',registryelementpath:['cluster','nodes'],availabilityfunc:portAvailability});
  dataMaster.invoke('dcpregistry/newNameForTemplate',{templateName:'DCPNode',type:'nodes',servaddress:req.connection.remoteAddress},'backoffice','dcp','dcp',function(errcode,errparams){
    if(errcode==='OK'){
      var servname = errparams[0];
      console.log(servname,'should be logged in');
      res.jsonp({name:servname,replicationPort:dataMaster.replicationPort});
    }
  });
};
