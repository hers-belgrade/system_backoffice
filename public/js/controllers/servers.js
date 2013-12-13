angular.module('mean.servers').controller('ServersController', ['$scope', '$routeParams', '$location', 'Global', 'Servers', function($scope, $routeParams, $location, Global, Servers) {
    $scope.global = Global;

    $scope.save = function() {
      var server = new Servers({
        name:this.name,
        password:this.password
      });
      console.log('server',server);
      server.$save(function(response){
        console.log(response);
      });
    };

    $scope.list = function() {
      Servers.query(function(servers){
        $scope.servers = servers;
      });
    };
}]);
