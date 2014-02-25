//LS => labeled series
function findLSCounter(ls,label){
  for(var i in ls){
    var rc = ls[i];
    if(rc.label === label){
      return rc;
    }
  }
};
function incLSCounter(ls,label,step){
  step = step || 1;
  var c = findLSCounter(ls,label);
  if(!c){
    ls.push({label:label,data:step});
  }else{
    c.data+=step;
  }
};
function deleteLSCounter(ls,label){
  var ind = -1;
  for(var i in ls){
    var rc = ls[i];
    if(rc.label === label){
      ind = i;    
    }
  }
  if(ind>=0){
    ls.splice(ind,1);
  }
};
function decLSCounter(ls,label,step){
  step = step || 1;
  var c = findLSCounter(ls,label);
  if(c){
    c.data-=step;
    if(!c.data){
      deleteLSCounter(ls,label);
    }
  }
};
angular.module('mean.system').controller('IndexController', ['$scope', 'Global', 'follower', function ($scope, Global, follower) {
    $scope.global = Global;
    $scope.realms = [];
    $scope.servers = [];
    $scope.serverplayers = [];
    $scope.gameclassplayers = [];
    $scope.rooms = {};
    follower.listenToUsers($scope.realms,{activator:function(username,realmname){
      incLSCounter(this,realmname);
    },deactivator:function(username,realmname){
      decLSCounter(this,realmname);
    }});
    var nf = follower.follow('cluster').follow('nodes');
    nf.listenToCollections($scope,{activator:function(servername){
      var rsf = nf.follow(servername).follow('server').follow('rooms');
      rsf.listenToCollections({ctx:this,servername:servername},{activator:function(roomname){
        var rf = rsf.follow(roomname);
        $scope.rooms[roomname] = rf.scalars;
        var rpf;
        rf.listenToScalar(this,'class',{setter:function(classname){
          if(rpf){rpf.destroy();}
          rpf = rf.listenToScalar(this,'playing',{setter:function(val,oldval){
            var delta = ((val||0)-(oldval||0));
            incLSCounter(this.ctx.serverplayers,this.servername,delta||0);
            //decLSCounter(this.ctx.serverplayers,this.servername,oldval||0);
            incLSCounter(this.ctx.gameclassplayers,classname,delta||0);
            //decLSCounter(this.ctx.gameclassplayers,classname,oldval||0);
            console.log(val,oldval,$scope.gameclassplayers);
          }});
        }});
      },deactivator:function(name){
      }});
    }});
}]);
