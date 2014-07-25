angular.module('mean.slottemplates').factory("SlotTemplates",['$resource',function($resource){
  return $resource('slottemplates/:stName',{
    stName: '@name'
  }, {
    update: {
      method: 'PUT'
    }
  });
}]);
