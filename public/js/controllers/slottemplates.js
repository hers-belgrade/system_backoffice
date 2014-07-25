angular.module('mean.slottemplates')
.controller('SlotTemplatesController',['$scope', 'SlotTemplates', 'follower', '$modal', function($scope, SlotTemplates, follower, $modal){

  function editor_extension ($scope, $modalInstance, template_data) {
	  var ininitalization = true;

    function getRowDef (index) {
      return {
        field:index+'', 
        displayName:(index+' x reward'),
        editableCellTemplate:'<input style="width:90%;" type="number" ng-class="\'colt\' + col.index" ng-input="COL_FIELD" ng-model="COL_FIELD" min="0" step="1">'
      };
    }

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
    if (!$scope.template.symbolweightsmults) $scope.template.symbolweightsmults = [];
    while($scope.template.symbolweightsmults.length < 2) {
      $scope.addSymbol();
    }
  }

	function Editor ($scope, $modalInstance, template_data) {
		$scope.existing = template_data && template_data._id && true;
		$scope.template = template_data || {};
		
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

  $scope.setup = {};
  $scope.template = {};

  var CRUDI = CRUDITemplate ($scope ,{
    template: SlotTemplates
    ,list_done: monitorRT
    ,create_template:'/views/slottemplates/create.html'
    ,removal_confirmation: '/views/slottemplates/confirm_template_removal.html'
    ,editor_extension:editor_extension
    ,preSave : function (data){
      var cp = {};
      for (var i in data) cp[i] = data[i];
      delete cp.index;
      cp.symbolweightsmults = JSON.stringify(cp.symbolweightsmults);
      return cp;
    }
    ,itemProcessor: function (item) {
      if (item.symbolweightsmults && 'string' === typeof(item.symbolweightsmults)) {
        item.symbolweightsmults = JSON.parse(item.symbolweightsmults);
      }
      return item;
    }
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
