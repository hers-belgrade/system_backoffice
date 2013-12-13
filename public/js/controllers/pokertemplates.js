angular.module('mean.pokertemplates').controller('PokerTemplatesController',['$scope', 'PokerTemplates', function($scope, PokerTemplates){
  $scope.needFLValue = function(bettingpolicy){
    return bettingpolicy==='FL';
  };
  $scope.save = function(){
    console.log(this);
    var pt = new PokerTemplates({
      name:this.name,
      type:this.type,
      capacity:this.capacity,
      bettingpolicy:this.bettingpolicy,
      fixedlimitvalue:this.fixedlimitvalue,
      bigblind:this.bigblind,
      speed:this.speed,
      flavor:this.flavor,
      timeoutValue:this.timeoutValue,
      bots:this.bots
    });
    pt.$save(function(response){
      console.log(response);
    });
  };
  $scope.list = function(){
    PokerTemplates.query(function(pts){
      console.log(pts);
      $scope.pokertemplates = pts;
    });
  };
}]);
