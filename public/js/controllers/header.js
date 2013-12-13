angular.module('mean.system').controller('HeaderController', ['$scope', 'Global', function ($scope, Global) {
    $scope.global = Global;

    $scope.menu = [{
        "title": "Register New Server",
        "link": "servers/create"
    },{
      "title": "Register New Poker Template",
      "link": "pokertemplates/create"
    }];
    
    $scope.isCollapsed = false;
}]);
