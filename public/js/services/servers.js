//Servers service used for servers REST endpoint
angular.module('mean.servers').factory("Servers", ['$resource', function($resource) {
    return $resource('servers/:name', {
        name: '@name'
    }, {
        update: {
            method: 'PUT'
        }
    });
}]);

