angular.module('mean.charting').directive('piechart',function() {
  return {
    restrict: 'E',
    link: function(scope,elem,attrs){
      var chart = null;
      scope.$watch(attrs.ngModel,function(val){
        if(!chart){
          chart = $.plot(elem,val,{
            series: {
              pie: {
                show: true,
                tilt:0.8,
                highlight: {
                  opacity: 0.25
                },
                stroke: {
                  color: '#fff',
                  width: 2
                },
                startAngle: 2
              }
            },
            legend: {
              show: false,
              position: "ne", 
              labelBoxBorderColor: null,
              margin:[30,15]
            }
          });
          elem.show();
        }else{
          chart.setData(val);
          chart.draw();
        }
      },true);
    }
  }
});
function histogramDataFromLabeledSeries(ls, color){
  var data=[],options={bars:{fill:1,show:true,barWidth:0.5,align:'center',fillColor: color},xaxis:{min:0,ticks:[]}};
  var cnt = 0;
  for (var i in ls){
    var d = ls[i];
    data.push([cnt+0.5,d.data]);
    options.xaxis.ticks.push([cnt+0.5,d.label]);
    cnt++;
  }
  options.xaxis.max=cnt;
  return [data,options];
};
angular.module('mean.charting').directive('histogram',function() {
  return {
    restrict: 'E',
    link: function(scope,elem,attrs){
      scope.$watch(attrs.ngModel,function(val){
        var hd = histogramDataFromLabeledSeries(val,elem.css('color'));
        $.plot(elem,[{data:hd[0], color:elem.css('border-color')}],hd[1]);
        elem.show();
      },true);
    }
  }
});
