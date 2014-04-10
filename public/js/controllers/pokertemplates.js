angular.module('mean.pokertemplates').controller('PokerTemplatesController',['$scope', 'PokerTemplates', 'follower', function($scope, PokerTemplates, follower){
  $scope.setup = {editable:false};
  $scope.template = {};
  $scope.needFLValue = function(bettingpolicy){
    return bettingpolicy==='FL';
  };
  $scope.save = function(){
    var pt = new PokerTemplates(this.template);
    pt.$save(function(response){
      var rn = response.name;
      if(rn){
        for(var i in $scope.templates){
          var t = $scope.templates[i];
          if(t.name===rn){
            for(var j in response){
              t[j] = response[j];
            }
          }
        }
      }else{
        console.log(response);
      }
      $scope.setup.editable = false;
    });
  };
  $scope.list = function(){
    PokerTemplates.query(function(pts){
      console.log(pts);
      $scope.templates = pts;
      monitorRT();
    });
  };
  function templateFor(roomname){
    var matched, matchlen = 0;
    for(var i in $scope.templates){
      var t = $scope.templates[i];
      if(roomname.indexOf(t.name)===0){
        if(t.name.length>matchlen){
          matchlen=t.name.length;
          matched = t;
        }
      }
    }
    return matched;
  };
  function accountFor(roomname){
    var t = templateFor(roomname);
    if(t){
      if(!t.instances){
        t.instances=1;
      }else{
        t.instances++;
      }
    }
  };
  function monitorRT(){
    var nf = follower.follow('cluster').follow('nodes');
    nf.listenToCollections($scope,{activator:function(name){
      rsf = nf.follow(name).follow('server').follow('rooms');
      rsf.listenToCollections(this,{activator:function(name){
        accountFor(name);
      }});
    }});
  };
  $scope.setTemplate = function(t){
		if (!t['class']) t['class'] = 'Poker';
    $scope.template = t;
    $scope.setup.editable = true;
  };
  $scope.createNew = function(){
    $scope.setTemplate({});
    $scope.setup.editable = true;
  };
}]);
