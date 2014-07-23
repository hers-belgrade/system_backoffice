var mongoose = require('mongoose'),
    Server = mongoose.model('Server'),
    ServerLease = mongoose.model('ServerLease'),
    dataMaster = require('./datamaster'),
    hersdata = require('hersdata'),
    ArrayMap = hersdata.ArrayMap,
    Timeout = require('herstimeout'),
    hersdb = require('hersdb'),
    OfferHandler = hersdb.OfferHandler,
    DeStreamer = hersdata.DeStreamer,
    executable = hersdata.executable,
    execRun = executable.run,
    execCall = executable.call;

function ServerDescription(name,address,port,type,realmname){
  this.name = name;
  this.address = address;
  this.port = parseInt(port);
  this.type = type;
  this.realm = realmname;
  this.taken = false;
};
ServerDescription.prototype.equals = function(other){
  return this.address === other.address
    &&this.port === other.port
    &&this.type === other.type
    &&this.realm === other.realm;
};

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
  var servdesc = new ServerDescription(name,address,port,type,realmname);
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
      servdesc.address = address;
      servdesc.port = port;
      servdesc.realm = realmname;
      servdesc.type = type;
      ServerLease.findOneAndUpdate({name:index},servdesc,{upsert:true},function(err,data){
        if(!err){
          cb(data.name);
        }else{
          console.log('mongo error',err);
          cb();
        }
      });
    }else{
      console.log('back to square one',address,port,type,realmname,cb);
      Timeout.next(attachServer,address,port,type,realmname,cb); //back to square one
    }
    break;
  case 'undefined': //real request from physical server
    var name = unusedServerName(type,realmname);
    if(name){
      //console.log('server',name,'is in __servernames',__servernames);
      var sd = __servernames[name];
      console.log(name,'=>',sd,'is unused');
      if(!sd.equals(servdesc)){
        console.log(sd,'<>',servdesc);
        Timeout.set(attachServer,30000,address,port,type,realmname,cb,name); //30 secs of grace period for name to be taken by an already attached server 
        return;
      }
    }else{
      name = type+map.add(address+':'+port);
      if(realmname){
        name = realmname+name;
      }
    }
    servdesc.name = name;
    servdesc.taken = true;
    __servernames[name] = servdesc;
    ServerLease.findOneAndUpdate({name:name},servdesc,{upsert:true},function(err,data){
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

function handHistoryOfferShaper(offerid,data,cb){
  var dbdata = data[0][2];
  data[0][2] = '';
  dbdata.events = data;
  data = dbdata;
  execCall(cb,data);
}
function handIdReplyShaper(replyobj,offerobj,dbid,cb){
  replyobj.handId = dbid;
  execRun(cb);
}
function rakeAccountingOfferShaper(offerid,data,cb){
  data.handId = offerid;
  execCall(cb,data);
}
function rakeAccountingWritten(roomname,data){
  var pf = dataMaster.element(['cluster_interface','servers']).functionalities.profitfunctionality;
  if(!pf){return;}
  var timestamp = data.created.getTime(),handId=data.handId;
  for(var i in data.breakdown){
    var bd = data.breakdown[i];
    if(typeof bd.rake === 'undefined'){continue;}
    pf._account(timestamp,handId,bd.rake,this.klass,this.type,this.flavor,this.template,roomname,bd.name,bd.realm);
  }
}

function singleGameEventWritten(roomname,data){
  if(data.eventcode==='finish'){
    var pf = dataMaster.element(['cluster_interface','servers']).functionalities.profitfunctionality;
    if(!pf){return;}
    var timestamp = data.created.getTime(),handId=data.handId;
    pf._account(timestamp,handId,data.profit,this.klass,this.type,this.flavor,this.template,roomname,data.name,data.realm);
  }
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
        case 'templatename':
          this.template = item[1][1];
          break;
        case 'type':
          this.type = item[1][1];
          break;
        case 'flavor':
          this.flavor = item[1][1];
          break;
      }
    }
  });
  //f.handleOffer('gameEvent',[f,singleGameEventHandler]);
  new OfferHandler('SingleGameEvent',f,'gameEvent',{onDataWritten:[f,singleGameEventWritten,[roomname]]});
  new OfferHandler('HandHistory',f,'storeHandHistory',{onOffer:handHistoryOfferShaper});
  new OfferHandler('HandId',f,'handId',{onReplyReady:handIdReplyShaper});
  new OfferHandler('RakeAccounting',f,'storeRakeAccounting',{onOffer:rakeAccountingOfferShaper,onDataWritten:[f,rakeAccountingWritten,[roomname]]});
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
dataMaster.element(['cluster_interface','servers']).attach(__dirname+'/profitfunctionality',{});

function replicateServer(servname){
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
  replicateServer(servreplica.replicaToken.name);
});

dataMaster.element(['cluster_interface','servers']).newReplica.attach(function(servreplica){
  console.log('incoming (realm) replica',servreplica.replicaToken);
  replicateServer(servreplica.replicaToken.name);
});

exports.accept = function(req,res) {
  attachServer(req.connection.remoteAddress,req.query.port,req.query.type,'',function(name){
    res.jsonp({
      name:name,
      replicationPort:dataMaster.nodeReplicationPort
    });
  });
};
