angular.module('mean.slottemplates')
.controller('SlotTemplatesController',['$scope', 'SlotTemplates', 'follower', function($scope, SlotTemplates, follower){
  $scope.setup = {editable:false};
  $scope.template = {};

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

  function getRowDef (index) {
    return {
      field:index+'', 
      displayName:(index+' x reward'),
      editableCellTemplate:'<input style="width:90%;" type="number" ng-class="\'colt\' + col.index" ng-input="COL_FIELD" ng-model="COL_FIELD" min="0" step="1">'
    };
  }


	var ininitalization = true;
	function check_this_out() {
		console.log('!!!!!!!!!!!!!!!!!!!!!!!');
		return true;
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

  $scope.save = function(){
    var cp = {};
    for (var i in this.template) {
      cp[i] = this.template[i];
    }
    delete cp.index;
    cp.symbolweightsmults = JSON.stringify(cp.symbolweightsmults);
    var pt = new SlotTemplates(cp);

    pt.$save(function(response){
      var rn = response.name;

      response.symbolweightsmults = JSON.parse(response.symbolweightsmults);
      var done = false;
      if(rn){
        for(var i in $scope.templates){
          var t = $scope.templates[i];
          if(t.name===rn){
            for(var j in response){
              t[j] = response[j];
            }
            done = true;
          }
        }
      }
      (!done) && $scope.templates.push(response);
      $scope.setup.editable = false;
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
  $scope.setTemplate = function(t){
		if (!t['class']) t['class'] = 'Slot';
    $scope.template = t;
    $scope.setup.editable = true;
  };


	////CREATE NEW ACTIONS...
  $scope.createNew = function(){
    $scope.setTemplate({
			class: 'Slot',
      symbolweightsmults : [],
    });

		this.addSymbol();
		this.addSymbol();
    $scope.setup.editable = true;
  };

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
