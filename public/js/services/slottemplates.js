angular.module('mean.slottemplates').factory("SlotTemplates",['$resource',function($resource){
  return $resource('slottemplates/:templateName',{
    templateName: '@name'
  }, {
    update: {
      method: 'PUT'
    }
  });
}]);
