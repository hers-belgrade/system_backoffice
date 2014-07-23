angular.module('mean.slottemplates')
.controller('SlotTemplatesController',['$scope', 'SlotTemplates', 'follower', '$modal', function($scope, SlotTemplates, follower, $modal){
	function Editor ($scope, $modalInstance, template_data) {
		$scope.existing = template_data && template_data._id && true;
		$scope.template = template_data || {};

	  var ininitalization = true;

    $scope.addSymbol = function (e){
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      var ts = { weight:1,index:$scope.template.symbolweightsmults.length };

      if ($scope.template.columns) {
        for (var i = 0 ; i < $scope.template.columns; i++){
          ts[(i+1)+''] = 0;
        }
      }
      $scope.template.symbolweightsmults.push (ts);
    };

    $scope.removeSymbol = function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!$scope.template.symbolweightsmults.length) return;
      $scope.template.symbolweightsmults.pop();
    }

    if (!$scope.template.symbolweightsmults) $scope.template.symbolweightsmults = [];
    while($scope.template.symbolweightsmults.length < 2) {
      $scope.addSymbol();
    }

    $scope.gridColumnDefs = [];
    $scope.gridSettings = {
      'data': 'template.symbolweightsmults',
      'columnDefs':'gridColumnDefs',
      'enableCellEdit': true,
      'enableCellSelection':true,
      'enableRowSelection': false,
      'enableSorting':false,
      'multiSelect': false,
      'showFooter':true
    }

    $scope.$watch ('template.columns', function (nv,ov) {
      if (!ininitalization && nv === ov) return;

      var columns = nv;
      ininitalization = false;
      var p = [
      {field:'index',
        displayName:'Symbol',
        enableCellEdit: false,
        cellTemplate: '<div class="ngCellText" ng-class="col.colIndex()"><slottemplate-symbol stsvalue="row.getProperty(col.field)"></slottemplate-symbol></div>'
      },
      {
        field:'weight', 
        displayName:'Weight',
        editableCellTemplate:'<input style="width:90%;" type="number" ng-class="\'colt\' + col.index" ng-input="COL_FIELD" ng-model="COL_FIELD" min="0" step="0.01">'
      }];

      if (columns){
        for (var i = 0; i < columns; i++){
          p.push (getRowDef(i+1));
        }
      }
      $scope.gridColumnDefs = p;


      ///reconfigure scatter and joker mults if required
      if ($scope.template && $scope.template.symbolweightsmults) {
        for (var i = 0; i < $scope.template.symbolweightsmults.length; i++) {
          var sm = $scope.template.symbolweightsmults[i];
          for (var j = 0; j < columns; j++) {
            if ('undefined' === typeof(sm[(j+1)+''])) sm[(j+1)+''] = 0;
          }
        }
      }

    });


    function getRowDef (index) {
      return {
        field:index+'', 
        displayName:(index+' x reward'),
        editableCellTemplate:'<input style="width:90%;" type="number" ng-class="\'colt\' + col.index" ng-input="COL_FIELD" ng-model="COL_FIELD" min="0" step="1">'
      };
    }

		
		$scope.save = function () {
			$modalInstance.close({command:'save', data:$scope.template});
		}
		$scope.cancel = function () {
			$modalInstance.dismiss('cancel');
		}

    $scope.clone = function () {
      var nt = {};
      for (var i in $scope.template) nt[i] = $scope.template[i];
      nt._id = null;
      nt.name = null;
      nt.clone = true;
      $scope.template = nt;
    }
	}

  $scope.modal_instance = null;
  $scope.setup = {};
  $scope.template = {};
	function check_this_out() {
		return true;
	}

  function getIndex (data) {
    if (!data || !data.name) return -1;
    var index = 0;
    for (index=0 ; index < $scope.templates.length; index++){
      if ($scope.templates[index].name === data.name) return index;
    }
    return -1;
  }

  function do_save(data){
    var cp = {};

    for (var i in data) {
      cp[i] = data[i];
    }
    delete cp.index;

    cp.symbolweightsmults = JSON.stringify(cp.symbolweightsmults);
    var pt = new SlotTemplates(cp);

    pt.$save(function(response){
      var rn = response.name;
      response.symbolweightsmults = JSON.parse(response.symbolweightsmults);
      var done = false;
      if(rn){
        var index = getIndex({name: rn});
        if (index > -1) {
          var t = $scope.templates[index];
          for(var j in response){
            t[j] = response[j];
          }
          return;
        }
      }
      $scope.templates.push(response);
      return;
    });
  };

  $scope.list = function(){
    SlotTemplates.query(function(pts){
      for (var i in pts) {
        if (pts[i].symbolweightsmults) {
          pts[i].symbolweightsmults = JSON.parse(pts[i].symbolweightsmults);
        }
      }
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
  		templateUrl:'/views/slottemplates/create.html'
  		,size:'lm'
  		,backdrop: 'static'
  		,controller:Editor
  		,resolve: {
  			template_data: function () {return data;}
  		}
  	});

  	$scope.modal_instance.result.then(function (data) {
  		$scope.modal_instance = null;
      switch(data.command){
        case 'save': {
          do_save(data.data);
          break;
        }
      }
  	});
  }

	////CREATE NEW ACTIONS...
  $scope.createNew = function(){
    show_modal();
  };

  $scope.edit = function (index) {
    show_modal($scope.templates[index]);
  }

  $scope.copy = function (index) {
    var data = {};
    jQuery.extend(data, $scope.templates[index]);
    delete data._id;
    data.clone = data.name;
    delete data.name; 
    show_modal(data);
  }

  $scope.remove = function (index) {
    var data = $scope.templates[index];
    data.$remove(function (res) {
      var index = getIndex(res);
      if (index < 0) return;
      $scope.templates.splice(index, 1);
    });
  }
}])
.directive ('slottemplateSymbol', function () {
	///TODO: think if I should move rewards to separate column in ng-grid ...
	return {
		scope: {
			sts_value: '=stsvalue'
		},
		controller:function ($scope) {
			$scope.text = '';
			var t = $scope.sts_value;
			switch (t) {
				case 0 :
				$scope.text = 'Scatter (reward: free spins)';
				break;
				case 1:
				$scope.text = 'Joker (reward: extra mult)';
				break;
				default:
				$scope.text = t+' (reward: mult)';
			}
		},
		restrict: 'E',
		replace:false,
		template: '<span ng-cell-text>{{text}}</span>'
	}
});
;
