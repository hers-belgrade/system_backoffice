angular.module('mean.slottemplates').controller('SlotTemplatesController',['$scope', 'SlotTemplates', 'follower', function($scope, SlotTemplates, follower){
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
      displayName:(index+' x mult'),
      editableCellTemplate:'<input style="width:90%;" type="number" ng-class="\'colt\' + col.index" ng-input="COL_FIELD" ng-model="COL_FIELD" min="0" step="1">'
    };
  }

  $scope.$watch ('template.columns', function (nv,ov) {
    if (nv == ov) return;
    var p = [
    {field:'index',
      displayName:'Symbol',
      enableCellEdit: false
    },
    {
      field:'weight', 
      displayName:'Weight',
      editableCellTemplate:'<input style="width:90%;" type="number" ng-class="\'colt\' + col.index" ng-input="COL_FIELD" ng-model="COL_FIELD" min="0" step="0.01">'
    }];
    if (nv){
      for (var i = 0; i < nv; i++){
        p.push (getRowDef(i+1));
      }
    }
    $scope.gridColumnDefs = p;
  });

  $scope.save = function(){
    var cp = {};
    for (var i in this.template) {
      cp[i] = this.template[i];
    }
    delete cp.index;
    cp.symbolweightsmults = JSON.stringify(cp.symbolweightsmults);
    cp.scatter = JSON.stringify(cp.scatter);
    var pt = new SlotTemplates(cp);
    pt.$save(function(response){
      var rn = response.name;

      response.symbolweightsmults = JSON.parse(response.symbolweightsmults);
      response.scatter = JSON.parse(response.scatter);
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
          /// razmisli, mozda ne bi bilo lose da ovo odvojis ...
          pts[i].symbolweightsmults = JSON.parse(pts[i].symbolweightsmults);
        }

        if (pts[i].scatter) {
          pts[i].scatter = JSON.parse(pts[i].scatter);
        }else{
          pts[i].scatter = { probability: 0 }
          for (var j = 0 ; j < pts[i].columns; j++) {
            pts[i].scatter[j+1] = 0;
          }
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
    $scope.template = t;
    $scope.setup.editable = true;
  };
  $scope.createNew = function(){
    $scope.setTemplate({
      symbolweightsmults : [],
      scatter: {
        probability: 0,
      }
    });
    $scope.setup.editable = true;

    $scope.addSymbol = function (e){
      e.preventDefault();
      e.stopPropagation();
      var ts = { weight:1,index:$scope.template.symbolweightsmults.length };
      if ($scope.template.columns) {
        for (var i = 0 ; i < $scope.template.columns; i++){
          ts[(i+1)+''] = 0;
        }
      }
      $scope.template.symbolweightsmults.push (ts);
    },
    $scope.removeSymbol = function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!$scope.template.symbolweightsmults.length) return;
      $scope.template.symbolweightsmults.pop();
    }

  };
}]);
