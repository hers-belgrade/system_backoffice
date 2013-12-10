angular.module('mean.servers').controller('ServersController', ['$scope', '$routeParams', '$location', 'Global', 'Servers', function($scope, $routeParams, $location, Global, Servers) {
    $scope.global = Global;

    $scope.create = function() {
      var server = new Servers({
        name:this.name
      });
      server.$save(function(response){
        console.log(response);
      });
    };
}]);
