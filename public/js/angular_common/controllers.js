function CRUDITemplate ($scope,config, $modal) {
  $scope.modal_instance = null;
  function ConfirmRemoval ($scope, $modalInstance, template) {
    $scope.template = template;
    DoubleConfirmController($scope, $modalInstance);
  }

	function Editor ($scope, $modalInstance, template_data) {
    $scope.state = 'new';
    if (template_data) {
      if (template_data._id) {
        $scope.state = 'editing'
      }else if (template_data.clone) {
        $scope.state = 'cloning';
      }
    }

		$scope.template = template_data || {};
		
		$scope.save = function () {
			$modalInstance.close($scope.template);
		}
		$scope.cancel = function () {
			$modalInstance.dismiss('cancel');
		}
    config.editor_extension && config.editor_extension($scope, $modalInstance, template_data);
	}

  function getIndex(ts) {
    if (!ts || !ts.name) return -1;
    var index = 0;
    for (index = 0; index < $scope.templates.length; index++) {
      if ($scope.templates[index].name === ts.name) return index;
    }
    return -1;
  }

  function doSave (ts) {
    if (config.preSave) {
      ts = config.preSave(ts);
    }
    var pt = new (config.template)(ts);
    pt.$save(function(response){
      if (!response && !response.name) return;
      var index = getIndex(ts);
      if (index > -1) {
        $scope.templates[index] = config.itemProcessor ? config.itemProcessor(response) : response;
      }else{
        $scope.templates.push(config.itemProcessor ? config.itemProcessor(ts) : ts);
      }
    });
  }

  function show_modal (data) {
    data = data || null;
    $scope.modal_instance = $modal.open({
      templateUrl:config.create_template
      ,size:'lm'
      ,backdrop: 'static'
      ,controller:Editor
      ,resolve: {
        template_data: function () {return data;}
      }
    });

    $scope.modal_instance.result.then(function (result) {
      doSave(result);
      $scope.modal_instance = null;
    });
  }

  $scope.list = function(){
    (config.template).query(function(pts){
      $scope.templates = pts;
      if (config.itemProcessor) {
        for (var i in pts) {pts[i] = config.itemProcessor(pts[i]);}
      }
      ('function' === typeof(config.list_done)) && config.list_done();
    });
  };

  $scope.edit = function (index) {
  	show_modal($scope.templates[index]);
  }

  $scope.copy = function (index) {
    var nr = {};
    jQuery.extend(nr, $scope.templates[index]);
    delete nr._id;
    delete nr.name;
    nr.clone = $scope.templates[index];
    show_modal(nr);
  }

  $scope.remove = function (index) {
    var tt = $scope.templates[index];
    if (!tt) return;

    if (!$scope.confirmation) {
      $scope.confirmation = $modal.open({
        templateUrl:config.removal_confirmation
        ,backdrop: 'static'
        ,controller: ConfirmRemoval
        ,resolve: {
          template: function() {return tt;}
        }
      });

      $scope.confirmation.result.then (function (what) {
        if (what === 'ok') {
          tt.$remove(function (res) {
            var index = getIndex(res);
            if (index < 0) return;
            $scope.templates.splice(index, 1);
          });
        }
        $scope.confirmation = null;
      });
    }else{
      console.log('STA JE PROBLEM?');
    }
  }


  $scope.createNew = function(){
  	show_modal();
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

  return {
    templateFor: templateFor
    ,accountFor: accountFor
  }
}
