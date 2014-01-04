angular.module('mean.system').controller('HeaderController', ['$scope', 'Global', function ($scope, Global) {
    $scope.global = Global;

    $scope.menu = [{
        "title": "Servers",
        "link": "servers",
        "icon": "icon-desktop"
    },{
      "title": "Templates",
      "icon": "icon-text-width",
      submenu:[{
        "title": "Register New Poker Template",
        "link": "pokertemplates/create",
        "icon": "icon-double-angle-right"
      }]
    },{
        "title": "Servers",
        "link": "servers",
        "icon": "icon-desktop"
    }];
    
    $scope.loaded = function(){
    	setTimeout(function(){
    	var s = document.createElement('script'); // use global document since Angular's $document is weak
            s.src = '/lib/bootstrap/docs/assets/js/ace.min.js';
            document.body.appendChild(s);
            console.log('loaded',s);
          },1000);
    };
    
    $scope.isCollapsed = false;
}]);
