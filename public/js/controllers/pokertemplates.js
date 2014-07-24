angular.module('mean.pokertemplates').controller('PokerTemplatesController',['$scope', 'PokerTemplates', 'follower','$modal', function($scope, PokerTemplates, follower, $modal){
	
	function Editor ($scope, $modalInstance, template_data) {
		$scope.existing = template_data && true;
		$scope.template = template_data || {};
		
		$scope.save = function () {
			$modalInstance.close($scope.template);
		}
		$scope.cancel = function () {
			$modalInstance.dismiss('cancel');
		}
	}
	
	$scope.modal_instance = null;
  $scope.setup = {};
  $scope.template = {};
  $scope.needFLValue = function(bettingpolicy){
    return bettingpolicy==='FL';
  };
  function do_save(ts){
    var pt = new PokerTemplates(ts);
    pt.$save(function(response){
    	var existing = false;
      var rn = response._id;
      if(rn){
        for(var i in $scope.templates){
          var t = $scope.templates[i];
          if(t._id===rn){
          	existing = true;
            for(var j in response){
              t[j] = response[j];
            }
          }
        }
        if (!existing) {
        	$scope.templates.push(ts);
        }
      }else{
        console.log(response);
      }
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
  
  function show_modal (data){
  	data = data || null;
  	$scope.modal_instance = $modal.open({
  		templateUrl:'/views/pokertemplates/create.html'
  		,size:'lm'
  		,backdrop: 'static'
  		,controller:Editor
  		,resolve: {
  			template_data: function () {return data;}
  		}
  	});
  	$scope.modal_instance.result.then(function (result) {
  		do_save(result);
  		$scope.modal_instance = null;
  	});
  }
  $scope.edit = function (rec) {
  	show_modal(rec);
  }
  $scope.createNew = function(){
  	show_modal();
  };
}]);
