angular.module('mean.pokertemplates').factory("PokerTemplates",['$resource',function($resource){
  return $resource('pokertemplates/:templateName',{
    templateName: '@name'
  }, {
    update: {
      method: 'PUT'
    }
  });
}]);
