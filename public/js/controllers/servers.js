angular.module('mean.servers').controller('ServersController', ['$scope', '$routeParams', '$location', 'Global', 'Servers', 'follower', function($scope, $routeParams, $location, Global, Servers, follower) {
    $scope.global = Global;
    $scope.bostats = follower.scalars;
    $scope.nodestats = {};
    $scope.realmstats = {};
    $scope.realms = {};
    $scope.realm = {};
    $scope.rtrealms = {};

    $scope.save = function() {
      var server = new Servers(this.realm);
      console.log('server',server);
      server.$save(function(response){
        console.log(response);
      });
    };

    follower.follow('cluster').follow('realms').listenToCollections($scope.rtrealms,{activator:function(name){
      console.log('new server',name);
      this[name] = {
        connection : follower.follow('cluster').follow('realms').follow(name).scalars,
        status : follower.follow('cluster').follow('realms').follow(name).follow('server').scalars,
        rooms : follower.follow('cluster').follow('realms').follow(name).follow('server').follow('rooms').collections.length
      };
    },deactivator:function(name){
      delete this[name];
    }});
    var rf = follower.follow('stats').follow('realms');
    rf.listenToCollections($scope.realmstats,{activator:function(name){
      console.log('new realm',name);
      var nnf = rf.follow(name);
      this[name] = nnf.scalars;
    },deactivator:function(name){
      delete this[name];
    }});
    var nf = follower.follow('stats').follow('nodes');
    nf.listenToCollections($scope.nodestats,{activator:function(name){
      console.log('new node',name);
      var nnf = nf.follow(name),
        snnf = nnf.follow('server');
        rsnnf = snnf.follow('rooms');
      var obj = {
        connection : nnf.scalars,
        status : nnf.scalars,
        rooms : {}
      };
      this[name] = obj;
      rsnnf.listenToCollections(obj.rooms,{activator:function(name){
        rsnnf.follow(name).listenToScalar(this,'templatename',{setter:function(tn,otn){
          if(tn){
            if(!this[tn]){
              this[tn] = 1;
            }else{
              this[tn]++;
            }
          }else{
            this[otn]--;
          }
        }});
      }});
    },deactivator:function(name){
      delete this[name];
    }});

    $scope.list = function() {
      Servers.query(function(servers){
        $scope.realms = servers;
      });
    };

    $scope.setRealm = function(r){
      $scope.realm = r;
    };
}]);
