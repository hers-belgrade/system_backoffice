function triStateValue(svgelem,config){
  var pack = {
    dflt : svgelem[svgelem.id+'_value'][svgelem.id+'_value_default'],
    red : svgelem[svgelem.id+'_value'][svgelem.id+'_value_red'],
    green : svgelem[svgelem.id+'_value'][svgelem.id+'_value_green']
  },
    indicator = svgelem[svgelem.id+'_indicator'];
  config.suffix = config.suffix||'';
  function setVal(key,val){
    for(var i in pack){
      if(key!==i){
        pack[i].hide();
      }else{
        pack[i].show().set({text:val+config.suffix});
      }
    }
  }
  config.follower.listenToScalar(pack,config.scalarname,{setter:function(val,oldval){
    for(var i in config.range){
      var cre = config.range[i];
      if(val<=cre[0]){
        setVal(cre[1],val);
        break;
      }
    }
    if(indicator && indicator.usedObj){
      if(val===oldval){indicator.hide();return}
      var direction = (val>oldval) ? 'up' : 'down';
      var color = (config.preferences && config.preferences[direction]) ? config.preferences[direction] : 'green';
      var name = color+'_'+direction;
      indicator.usedObj.forEachObject(function(el){
        if(el.id===name){
          el.show();
        }else{
          el.hide();
        }
      });
    }
    if(config.cb){
      config.cb(val,oldval);
    }
  }});
  return svgelem;
}
var angleOffs = 15;
function triStateValueWNeedle(svgelem,config){
  var needle = svgelem[svgelem.id+'_meter'][svgelem.id+'_pointer'];
  config.cb = function(val,oldval){
    needle.set({localAngle:(-angleOffs+(180+2*angleOffs)*val/100)});
  };
  return triStateValue(svgelem,config);
}
function serverFollower(servname,follower,canvas){
  console.log('serverFollower',follower,canvas);
  fabric.loadResources({
    root:'/img/svgs',
    svg:['server']
  },function(loaded){
    var s = loaded.server;
    canvas.add(s);
    var server = s.server;
    server.server_name.set({text:servname});
    var stats = server.statistics;
    server.server_status.forEachObject(function(el){
      el.hide();
    });
    server.server_name.forEachObject(function(el){
      el.set({text:servname});
      el.hide();
    });
    follower.listenToScalar(server,'status',{setter:function(val){
      var color;
      switch(val){
        case 'connected':
          color='green';
          break;
        case 'disconnected':
          color='red';
          break;
        default:
          color='default';
          break;
      }
      var n = this.server_name.id+'_'+color;
      this.server_name.forEachObject(function(el){
        if(el.id===n){
          el.show();
        }else{
          el.hide();
        }
      });
      var sn = 'server_'+val;
      this.server_status.forEachObject(function(el){
        if(el.id===sn){
          el.show();
        }else{
          el.hide();
        }
      });
    }});
    triStateValueWNeedle(stats.cpu_usage,{follower:follower,scalarname:'CPU',range:[
      [20,'green'],
      [80,'dflt'],
      [1000,'red']
    ],suffix:'%'});
    triStateValue(stats.delay,{follower:follower,scalarname:'exec_delay',range:[
      [80,'green'],
      [200,'dflt'],
      [1000000,'red']
    ],preferences:{
      up:'red',
      down:'green'
    },suffix:'ms'});
    triStateValue(stats.dcp_branches,{follower:follower,scalarname:'dcp_branches',range:[
      [1000,'green'],
      [4000,'dflt'],
      [1000000,'red']
    ],preferences:{
      up:'red',
      down:'green'
    },suffix:''});
    triStateValue(stats.dcp_leaves,{follower:follower,scalarname:'dcp_leaves',range:[
      [1000,'green'],
      [40000,'dflt'],
      [1000000,'red']
    ],preferences:{
      up:'red',
      down:'green'
    },suffix:''});
    triStateValue(stats.players,{follower:follower,scalarname:'players',range:[
      [1000,'green'],
      [2000,'dflt'],
      [1000000,'red']
    ],suffix:''});
  });
}

angular.module('mean.charting').directive('serverindicator',function(follower) {
  return {
    restrict: 'E',
    link: function(scope,elem,attrs){
      var d = document.createElement('canvas');
      d.id = 'server_'+scope.name;
      d.width = 1000;
      d.height = 125;
      elem[0].style.width = '1000px';
      elem[0].style.height = '125px';
      elem[0].appendChild(d);
      serverFollower(scope.name,follower.follow('stats').follow(attrs.servertype||'nodes').follow(scope.name),new fabric.Canvas(d.id));
    }
  }
});
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
