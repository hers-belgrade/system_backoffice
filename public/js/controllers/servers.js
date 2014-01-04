angular.module('mean.servers').controller('ServersController', ['$scope', '$routeParams', '$location', 'Global', 'Servers', 'follower', function($scope, $routeParams, $location, Global, Servers, follower) {
    $scope.global = Global;
    $scope.bostats = follower.scalars;
    $scope.nodes = {};
    $scope.realms = {};
    $scope.realm = {};
    $scope.rtrealms = {};

    $scope.save = function() {
      var server = new Servers(this.server);
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
        rooms : follower.follow('cluster').follow('realms').follow(name).follow('server').follow('rooms').collections
      };
    },deactivator:function(name){
      delete $scope.servers[name];
    }});
    follower.follow('cluster').follow('nodes').listenToCollections($scope.nodes,{activator:function(name){
      console.log('new server',name);
      this[name] = {
        connection : follower.follow('cluster').follow('nodes').follow(name).scalars,
        status : follower.follow('cluster').follow('nodes').follow(name).follow('server').scalars,
        rooms : follower.follow('cluster').follow('nodes').follow(name).follow('server').follow('rooms').collections
      };
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
