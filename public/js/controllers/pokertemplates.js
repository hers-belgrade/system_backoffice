angular.module('mean.pokertemplates').controller('PokerTemplatesController',['$scope', 'PokerTemplates', 'follower','$modal', function($scope, PokerTemplates, follower, $modal){
  var CRUDI = CRUDITemplate($scope, {
    template: PokerTemplates
    ,list_done:monitorRT
    ,create_template: '/views/pokertemplates/create.html'
    ,removal_confirmation:'/views/pokertemplates/confirm_removal.html'
  }, $modal);

  function monitorRT(){
    var nf = follower.follow('cluster').follow('nodes');
    nf.listenToCollections($scope,{activator:function(name){
      rsf = nf.follow(name).follow('server').follow('rooms');
      rsf.listenToCollections(this,{activator:function(name){
        CRUDI.accountFor(name);
      }});
    }});
  };


}]);
