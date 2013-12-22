angular.module('mean.system').controller('HeaderController', ['$scope', 'Global', function ($scope, Global) {
    $scope.global = Global;

    $scope.menu = [{
        "title": "Servers",
        "link": "servers"
    },{
      "title": "Templates",
      submenu:[{
        "title": "Register New Poker Template",
        "link": "pokertemplates/create"
      }]
    }];
    
    $scope.isCollapsed = false;
}]);
