var mongoose = require('mongoose'),
    _ = require('underscore'),
    Server = mongoose.model('Server'),
    HandId = mongoose.model('HandId'),
    HandHistory = mongoose.model('HandHistory'),
    dataMaster = require('./datamaster'),
    hersdata = require('hersdata'),
    Timeout = require('herstimeout'),
    RacingLogger = require('./RacingLogger'),
    DeStreamer = hersdata.DeStreamer;

var HandIdLogger = new RacingLogger(HandId),
  HandHistoryLogger = new RacingLogger(HandHistory);

function handlePlaying(roomname,flwr,newplaying){
  flwr.playing = flwr.playing || 0;
  if(!flwr.klass){return;}
  var se = flwr._parent._parent.data.statsBranch,
    le = flwr._parent._parent.data.localStatsBranch;
  var gactions = [
    ['set',['players'],[se.element(['players']).value()+newplaying-flwr.playing,undefined,'dcp']]
  ];
  var gcse = se.element(['players_by_gameclass',flwr.klass]);
  if(!gcse){
    gactions.push(['set',['players_by_gameclass',flwr.klass],[newplaying-flwr.playing,undefined,'dcp']]);
  }else{
    gactions.push(['set',['players_by_gameclass',flwr.klass],[gcse.value()+newplaying-flwr.playing,undefined,'dcp']]);
  }
  Timeout.next(se,'commit','room_stats_change',gactions);
  var lactions = [];
  var sse = le.elementRaw('players');
  if(!sse){
    lactions.push(['set',['players'],[newplaying-flwr.playing,undefined,'dcp']]);
  }else{
    lactions.push(['set',['players'],[sse.value()+newplaying-flwr.playing,undefined,'dcp']]);
  }
  Timeout.next(le,'commit','room_stats_change',lactions);
  flwr.playing = newplaying;
}

function followRoom(roomsfollower,roomname){
  console.log('following',roomname);
  var f = roomsfollower.follow([roomname],function(stts){
  },function(item){
    //console.log(item);
    if(item && item[1]){
      switch(item[1][0]){
        case 'class':
          f.klass = item[1][1];
          break;
        case 'playing':
          handlePlaying(item[0][0],f,parseInt(item[1][1]) || 0);
          break;
      }
    }
  });
  f.handleOffer('storeHandHistory',function(offerid,data){
    console.log('storeHandHistory',offerid,data);
    if(!data){return;}
    data = JSON.parse(data);
    if(data[0][1]!==1){
      console.log('first hand event needs to have id 1',data[0]);
      return;
    }
    var dbdata = data[0][2];
    data[0][2] = '';
    dbdata.events = data;
    data = dbdata;
    console.log('room',roomname,'needs storeHandHistory',offerid,data);
    var rn = roomname;
    HandHistoryLogger.getId(function(id){
      var _data = data;
      f.offer(['storeHandHistory'],{offerid:offerid,dbid:id},function(errc){
        console.log('storeHandHistory said',arguments);
        if(errc==='ACCEPTED'){
          HandHistoryLogger.saveId(id,_data);
        }
      });
    });
  });
  f.handleOffer('handId',function(offerid,data){
    if(!data){return;}
    data = JSON.parse(data);
    data.server = f._parent._parent.serverName;
    console.log('saving',data);
    HandIdLogger.getId(function(id){
      if(!id){
        console.trace();
        console.log('RacingLogger gave me no id',id);
        process.exit(0);
      }
      var _data = data;
      f.offer(['handId'],{offerid:offerid,handId:id},function(errc){
        //console.log('offer said',arguments);
        if(errc==='ACCEPTED'){
          _data.created = Date.now();
          HandIdLogger.saveId(id,_data);
        }else{
          HandIdLogger.rollback(id);
        }
      });
    });
  });
}

function followRooms(user){
  var f = user.follow(['rooms'],function(stts){
  },function(item){
    //console.log(item);
    if(item && item[1] && item[1][1]===null){
      followRoom(f,item[1][0]);
    }
  });
};

dataMaster.commit('servers_init',[
  ['set',['cluster_interface'],'dcp'],
  ['set',['cluster_interface','servers'],'dcp'],
  ['set',['cluster']],
  ['set',['cluster','realms'],'dcp'],
  ['set',['cluster','nodes']],
  ['set',['stats'],'dcp'],
  ['set',['stats','players'],[0,undefined,'dcp']],
  ['set',['stats','players_by_gameclass'],'dcp'],
]);

dataMaster.element(['cluster_interface']).attach(__dirname+'/dcpregistry',{targetdata:dataMaster});

var nodeReplicationPort = 16020, realmReplicationPort = 16021;
dataMaster.nodeReplicationPort = nodeReplicationPort;
dataMaster.realmReplicationPort = realmReplicationPort;
dataMaster.element(['cluster_interface']).openReplication(nodeReplicationPort);
dataMaster.element(['cluster_interface','servers']).openReplication(realmReplicationPort);

var portMap = {};

function handHistoryWait(user){
  var handHistoryWaitFunc = function(){
  };
  return handHistoryWaitFunc;
}

function ReplicateServer(type,servname,servaddress){
  console.log('ReplicateServer',type,servname,servaddress);
  var clusteractions = [], 
    clusterinterfaceactions = [], 
    replicationport=portMap[servaddress];
  var servcontel = dataMaster.element(['cluster',type,servname]);
  if(!servcontel){
    clusteractions.push(['set',[type,servname]]);
  }else{
    var servstatusel = servcontel.element(['status']);
    if(servstatusel){
      console.log('how come there is a status on',servname,'?');
    }
  }
  clusteractions.push(
    ['set',[type,servname,'address'],[servaddress,undefined,'dcp']]
  );
  clusterinterfaceactions.push(
    ['set',[servname],servname],
    ['set',[servname,'type'],[type.substr(0,type.length-1),undefined,'dcp']],
    ['set',[servname,'address'],[servaddress,undefined,'dcp']],
    ['set',[servname,'replicationPort'],[replicationport,undefined,'dcp']]
  );
  var statsel = dataMaster.element(['stats']);
  if(!dataMaster.element(['stats',type])){
    dataMaster.element(['stats']).commit('new_stats_server_type',[
      ['set',[type],'dcp']
    ]);
  }
  statsel.commit('new_server',[['set',[type,servname],'dcp']]);
  dataMaster.element(['cluster']).commit('new_server',clusteractions);
  dataMaster.element(['cluster_interface','servers']).commit('new_server',clusterinterfaceactions);
  servcontel = dataMaster.element(['cluster',type,servname]);
  servcontel.createRemoteReplica('server','dcp','dcp',{address:servaddress,port:replicationport},true);
  var servel = dataMaster.element(['cluster',type,servname,'server']);
  servel.statsBranch = statsel;
  servel.localStatsBranch = statsel.element([type,servname]);
  servel.go(function(status){
    console.log(servname,status);
    servcontel.commit('status_change',[
      ['set',['status'],[status,undefined,'dcp']]
    ]);
    statsel.commit('status_change',[
      ['set',[type,servname,'status'],[status,undefined,'dcp']]
    ]);
  });
  servel.getReplicatingUser(function(user){
    user.serverName = servname;
    user.follow([],function(stts){
    },function(item){
      DeStreamer.prototype.destream.call(this.data.localStatsBranch,item);
    });
    if(type==='nodes'){
      followRooms(user);
    }
  });
};

var portAvailability = function(el,name,searchobj){
  console.log('checking',el.dataDebug());
  var servaddress = searchobj.servaddress;
  var st = el.element(['status']);
  if(st){
    return st.value()==='disconnected';
  }
  console.log(el.dataDebug(),'has no status',portMap[servaddress]);
  portMap[servaddress]++;
  ReplicateServer(searchobj.type,name,servaddress);
  return true;
};

function fakeServerUser(user){
  return {
    username:function(){return user.username},
    realmname:function(){return user.realmname}
  };
};

exports.authCallback = function(req, res, next){
  if(!portMap[req.connection.remoteAddress]){
    portMap[req.connection.remoteAddress] = 16100;
  };
  var servname = req.user.name;
  var servdomain = req.user.domain;
  var realmtemplatename = '*'+servname+'Realm';
  dataMaster.element(['cluster_interface']).functionalities.dcpregistry.f.registerTemplate({templateName:realmtemplatename,registryelementpath:['cluster','realms'],availabilityfunc:portAvailability});
  dataMaster.element(['cluster_interface']).functionalities.dcpregistry.f.newNameForTemplate({templateName:realmtemplatename,type:'realms',servaddress:req.connection.remoteAddress},function(errcode,errparams){
    if(errcode==='OK'){
      var servname = errparams[0];
      console.log(servname,'should be logged in');
      res.jsonp({name:servname,domain:servdomain,replicationPort:dataMaster.realmReplicationPort});
    }
  },fakeServerUser(req.user));
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

function findAndEngage(type,servreplica){
  var servname = servreplica.replicaToken.name;
  var servaddress = servreplica.socket.remoteAddress;
  console.log('finding',servname,servaddress,'to engage');
  if(!portMap[servaddress]){
    portMap[servaddress]=16100;
  }
  var servcontel = dataMaster.element(['cluster',type,servname]);
  if(servcontel){
    console.log(servname,'found',servcontel.dataDebug());
    servreplica.replicaToken.type=type;
    if(!servcontel.element(['status'])){
      console.log('replica',type,servname,'logged in');
      portMap[servaddress]++;
      ReplicateServer(type,servname,servaddress);
      console.log(servname,'engaged');
      return true;
    }
  }else{
    console.log('autocreating');
    servcontel = dataMaster.commit('new_server',[
      ['set',['cluster',type,servname]]
    ]);
    console.log('replica',type,servname,'ressurected');
    portMap[servaddress]++;
    ReplicateServer(type,servname,servaddress);
    return true;
  }
};

dataMaster.element(['cluster_interface']).newReplica.attach(function(servreplica){
  console.log('incoming (node) replica',servreplica.replicaToken);
  findAndEngage('nodes',servreplica);
});

dataMaster.element(['cluster_interface','servers']).newReplica.attach(function(servreplica){
  console.log('incoming (realm) replica',servreplica.replicaToken);
  findAndEngage('realms',servreplica);
});

exports.accept = function(req,res) {
  if(!portMap[req.connection.remoteAddress]){
    portMap[req.connection.remoteAddress] = 16100;
  };
  dataMaster.element(['cluster_interface']).functionalities.dcpregistry.f.registerTemplate({templateName:'*Node',registryelementpath:['cluster','nodes'],availabilityfunc:portAvailability});
  dataMaster.element(['cluster_interface']).functionalities.dcpregistry.f.newNameForTemplate({templateName:'*Node',type:'nodes',servaddress:req.connection.remoteAddress},function(errcode,errparams){
    if(errcode==='OK'){
      var servname = errparams[0];
      console.log(servname,'should be logged in');
      res.jsonp({name:servname,replicationPort:dataMaster.nodeReplicationPort});
    }
  },{username:function(){return 'backoffice'},realmname:function(){return 'dcp'}});
};
