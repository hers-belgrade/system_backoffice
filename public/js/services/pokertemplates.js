angular.module('mean.pokertemplates').factory("PokerTemplates",['$resource',function($resource){
  return $resource('pokertemplates/:ptName',{
    ptName: '@name'
  }, {
    update: {
      method: 'PUT'
    }
  });
}]);
