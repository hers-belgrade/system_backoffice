var mongoose = require('mongoose'),
    _ = require('underscore'),
    Server = mongoose.model('Server'),
    ServerLease = mongoose.model('ServerLease'),
    HandId = mongoose.model('HandId'),
    RakeAccounting = mongoose.model('RakeAccounting'),
    HandHistory = mongoose.model('HandHistory'),
    dataMaster = require('./datamaster'),
    hersdata = require('hersdata'),
    ArrayMap = hersdata.ArrayMap,
    Timeout = require('herstimeout'),
    RacingLogger = require('./RacingLogger'),
    DeStreamer = hersdata.DeStreamer;

var HandIdLogger = new RacingLogger(HandId),
  RakeAccountingLogger = new RacingLogger(RakeAccounting),
  HandHistoryLogger = new RacingLogger(HandHistory);

var __maps = {};
var __servernames = {};

var nodeReplicationPort = 16020, realmReplicationPort = 16021;
dataMaster.nodeReplicationPort = nodeReplicationPort;
dataMaster.realmReplicationPort = realmReplicationPort;

function unusedServerName(type,realm){
  for(var i in __servernames){
    console.log('testing server',i);
    var servdesc = __servernames[i];
    if(servdesc.type===type && !servdesc.taken){
      if(realm&&servdesc.realm!==realm){
        continue;
      }
      return i;
    }
  }
}

function indexForNameTypeRealm(name,type,realm){
  var ret = name;
  if(!type){
    return;
  }
  if(realm){
    ret = ret.substring(realm.length);
  }
  ret = ret.substring(type.length);
  return parseInt(ret);
}

ServerLease.find({},function(err,data){
  console.log('ServerLeases',data);
  for(var i in data){
    var servdesc = data[i];
    var index = indexForNameTypeRealm(servdesc.name,servdesc.type,servdesc.realm);
    if(isNaN(index)){
      continue;
    }
    attachServer(servdesc.address,servdesc.port,servdesc.type,servdesc.realm,null,index,servdesc.name);
  }
  dataMaster.element(['cluster_interface']).openReplication(nodeReplicationPort);
  dataMaster.element(['cluster_interface','servers']).openReplication(realmReplicationPort);
});

function mapForTypeRealm(type,realmname){
  var map = __maps[type];
  if(!map){
    if(realmname){
      map = {};
      __maps[type] = map;
    }else{
      map = new ArrayMap();
      __maps[type] = map;
      return map;
    }
  }
  if(realmname){
    var realmmap = map[realmname];
    if(!realmmap){
      realmmap = new ArrayMap();
      map[realmname] = realmmap;
    }
    return realmmap;
  }
  return map;
}

function attachServer(address,port,type,realmname,cb,index,name){
  var map = mapForTypeRealm(type,realmname);
  var servdesc = {
    address:address,
    port:port,
    type:type,
    realm:realmname
  };
  switch(typeof index){
  case 'number': //initial allocation from db, before requests start coming in
    console.log('allocating',index,name);
    map.allocate(index,name);
    __servernames[name] = servdesc;
    console.log(__servernames);
    break;
  case 'string': //retry taking an unused name slot
    var servdesc = __servernames[index];
    if(!__servernames[index]){
      console.log('no server named',index,'in __servernames');
      process.exit(0);
    }
    if(!servdesc.taken){ //ok, grace period expired
      servdesc.taken = true;
      cb(index);
    }else{
      console.log('back to square one',address,port,type,realmname,cb);
      Timeout.next(attachServer,address,port,type,realmname,cb); //back to square one
    }
    break;
  case 'undefined': //real request from physical server
    var name = unusedServerName(type,realmname);
    if(name){
      console.log('server',name,'is in __servernames',__servernames);
      Timeout.set(attachServer,30000,address,port,type,realmname,cb,name); //30 secs of grace period for name to be taken by an already attached server 
      return;
    }
    name = type+map.add(address+':'+port);
    if(realmname){
      name = realmname+name;
    }
    servdesc.taken = true;
    __servernames[name] = servdesc;
    ServerLease.findOneAndUpdate({name:name},{
      name:name,
      address:address,
      port:port,
      type:type,
      realm:realmname
    },{upsert:true},function(err,data){
      if(!err){
        cb(data.name);
      }else{
        console.log('mongo error',err);
        cb();
      }
    });
    break;
  }
}

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
  le.commit('room_stats_change',lactions);
  flwr.playing = newplaying;
}

function followRoom(roomsfollower,roomname){
  console.log('following',roomname);
  var f = roomsfollower.follow([roomname],function(stts){
    if(stts==='RETREATING'){
      if(this.playing){
        console.log('unfollowing',roomname,'with',this.playing,'players');
        process.exit(0);
      }
      this.destroy();
    }
  },function(item){
    if(item && item[1]){
      switch(item[1][0]){
        case 'class':
          this.klass = item[1][1];
          break;
        case 'playing':
          Timeout.next(handlePlaying,item[0][0],this,parseInt(item[1][1]) || 0);
          break;
      }
    }
  });
  f.handleOffer('storeRakeAccounting',function(offerid,data){
    if(!data){return;}
    data = JSON.parse(data);
    data.handId = offerid;
    RakeAccountingLogger.getId(function(id){
      var _data = data;
      f.offer(['storeRakeAccounting'],{offerid:offerid,dbid:id},function(errc){
        if(errc==='ACCEPTED'){
          RakeAccountingLogger.saveId(id,_data);
        }
      });
    });
  });
  f.handleOffer('gameEvent',function(offerid,data){
    if(!data){return;}
    data = JSON.parse(data);
    console.log('gameEvent',data);
    f.offer(['gameEvent'],{offerid:offerid,ok:true});
  });
  f.handleOffer('storeHandHistory',function(offerid,data){
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
    HandHistoryLogger.getId(function(id){
      var _data = data;
      f.offer(['storeHandHistory'],{offerid:offerid,dbid:id},function(errc){
        if(errc==='ACCEPTED'){
          HandHistoryLogger.saveId(id,_data);
        }
      });
    });
  });
  f.handleOffer('handId',function(offerid,data){
    console.log('handId needed',offerid,data);
    if(!data){return;}
    data = JSON.parse(data);
    data.server = f._parent._parent.serverName;
    HandIdLogger.getId(function(id){
      if(!id){
        console.trace();
        console.log('RacingLogger gave me no id',id);
        process.exit(0);
      }
      var _data = data;
      f.offer(['handId'],{offerid:offerid,handId:id},function(errc){
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

function ReplicateServer(servname){
  var clusteractions = [], 
    clusterinterfaceactions = [], 
    servdesc = __servernames[servname];
  if(!servdesc){
    console.log('no servdesc for',servname,'in',__servernames);
    return;
  }
  servdesc.taken = true;
  var servaddress = servdesc.address,
    replicationport = servdesc.port,
    type = servdesc.type+'s';
  console.log('replicating',servname,servaddress,replicationport,type);
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
  console.log('creating RemoteReplica',servaddress,replicationport);
  servcontel.createRemoteReplica('server','dcp','dcp',{address:servaddress,port:replicationport},true);
  servcontel.commit('init_server',[['set',['status'],['initialized',undefined,'dcp']]]);
  var servel = dataMaster.element(['cluster',type,servname,'server']);
  servel.statsBranch = statsel;
  servel.localStatsBranch = statsel.element([type,servname]);
  servel.go(function(status){
    var scstatus = servcontel.elementRaw('status').value(), newscstatus;
    switch(scstatus){
      case 'initialized':
        if(status!=='initialized'){
          newscstatus=status;
        }
        break;
      case 'connected':
        if(status!=='connected'){
          newscstatus='reconnecting';
          var servdesc = __servernames[servname];
          if(servdesc){
            var map = mapForTypeRealm(servdesc.type,servdesc.realm);
            map.remove(indexForNameTypeRealm(servname,servdesc.type,servdesc.realm));
            delete __servernames[servname];
            ServerLease.findOneAndRemove({name:servname},function(){});
          }
        }
      default:
        if(status==='connected'){
          newscstatus=status;
        }
        break;
        break;
    }
    //console.log(servname,scstatus,'+',status,'=',newscstatus);
    if(newscstatus){
      servcontel.commit('status_change',[
        ['set',['status'],[newscstatus,undefined,'dcp']]
      ]);
      statsel.commit('status_change',[
        ['set',[type,servname,'status'],[newscstatus,undefined,'dcp']]
      ]);
    }
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

exports.authCallback = function(req, res, next){
  attachServer(req.connection.remoteAddress,req.query.port,req.query.type,req.user.name,function(name){
    res.jsonp({
      name:name,
      domain:req.user.domain,
      replicationPort:dataMaster.realmReplicationPort
    });
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

dataMaster.element(['cluster_interface']).newReplica.attach(function(servreplica){
  console.log('incoming (node) replica',servreplica.replicaToken);
  ReplicateServer(servreplica.replicaToken.name);
});

dataMaster.element(['cluster_interface','servers']).newReplica.attach(function(servreplica){
  console.log('incoming (realm) replica',servreplica.replicaToken);
  ReplicateServer(servreplica.replicaToken.name);
});

exports.accept = function(req,res) {
  attachServer(req.connection.remoteAddress,req.query.port,req.query.type,'',function(name){
    res.jsonp({
      name:name,
      replicationPort:dataMaster.nodeReplicationPort
    });
  });
};
