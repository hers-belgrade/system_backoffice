var mongoose = require('mongoose'),
    _ = require('underscore'),
    Server = mongoose.model('Server'),
    dataMaster = require('./datamaster'),
    hersdata = require('hersdata'),
    Timeout = require('herstimeout'),
    __handId = 0;

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
    var sn = servname, se = statsel, _type = type;
    servel.communication.masterSays.attach(function(item){
      var p = item[0];
      var d = item[1];
      if(p&&p.length===0){
        dataMaster.element(['stats',_type,sn]).commit('slave_system_change',[
          ['set',[d[0]],[d[1],undefined,'dcp']]
        ]);
      }
    });
    if(type==='nodes'){
      user.waitFor(['rooms','*',['class','playing']],function(roomname,map,oldmap){
        if(roomname==='DISCARD_THIS'){
          //clean up all from server named sn
          return;
        }
        var oldplaying = oldmap ? oldmap.playing : 0;
        var actions = [
          ['set',['players'],[se.element(['players']).value()+map.playing-oldplaying,undefined,'dcp']]
        ];
        var gcse = se.element(['players_by_gameclass',map.class]);
        if(!gcse){
          actions.push(['set',['players_by_gameclass',map.class],[map.playing-oldplaying,undefined,'dcp']]);
        }else{
          actions.push(['set',['players_by_gameclass',map.class],[gcse.value()+map.playing-oldplaying,undefined,'dcp']]);
        }
        var sse = se.element([_type,sn,'players']);
        if(!sse){
          actions.push(['set',[_type,sn,'players'],[map.playing-oldplaying,undefined,'dcp']]);
        }else{
          actions.push(['set',[_type,sn,'players'],[sse.value()+map.playing-oldplaying,undefined,'dcp']]);
        }
        Timeout.next(function(se,a){se.commit('room_stats_change',a);},se,actions);
      });
      user.waitForever(['rooms','*','__requirements','storeHandHistory','offers','*','data'],function(roomname,offerid,data){
        if(roomname==='DISCARD_THIS'){
          handHistoryWaitFunc();
          return;
        }
        if(!data){return;}
        data = JSON.parse(data);
        console.log('room',roomname,'needs storeHandHistory',offerid,data);
        __handId++;
        this.offer(['rooms',roomname,'storeHandHistory'],{offerid:offerid,dbid:1});
      });
      user.waitForever(['rooms','*','__requirements','handId'], function(roomname,room){
        if(!room){return;}
        console.log('room',roomname,'needs handId');
        __handId++;
        this.bid(['rooms',roomname,'handId'],{handId:__handId});
      });
      (handHistoryWait(user))();
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
