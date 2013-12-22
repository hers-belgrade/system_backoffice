var mongoose = require('mongoose'),
    _ = require('underscore'),
    PokerTemplate = mongoose.model('PokerTemplate'),
    dataMaster = require('./datamaster');

function pokerTemplateToDCPInsert(pt){
  var to = pt.toObject();
  delete to.__v;
  delete to._id;
  return ['set',['templates','pokerroom',to.name],[JSON.stringify(to),undefined,'dcp']];
}

PokerTemplate.find({},function(err,pts){
  var actions = [
    ['set',['templates'],'dcp'],
    ['set',['templates','pokerroom'],'dcp']
  ];
  for(var i in pts){
    actions.push(pokerTemplateToDCPInsert(pts[i]));
  }
  dataMaster.commit('poker_templates_init',actions);
});

function templateSearch(el,name,searchobj){
  //console.log('searching in',el.dataDebug());
  var servs = el.keys();
  for(var i in servs){
    var ret = el.element([servs[i],name]);
    if(ret){
      return ret;
    }
  }
};

function newTemplateInstance(el,name,searchobj,username,realmname){
  //console.log('new pt',name,username,el.dataDebug());
  el.commit('new_pokertemplate_instance',[
    ['set',[username,name]]
  ]);
};

function availabilityFunc(tplel,name,searchobj,username,realmname){
  var ptel = dataMaster.element(['cluster',username,name]);
  if(ptel){
    if(dataMaster.element(['cluster',username,'status']).value()!=='connected'){
      //tricky part, if the server's not connected, take the room away from it...?
    }
    return true;
  }else{
    return true;
  }
};

exports.save = function(req, res) {
  PokerTemplate.findOneAndUpdate({name:req.body.name},req.body,{upsert:true,new:true},function(err,pt){
    if(err){
      res.send(err);
      return;
    }
    dataMaster.commit('new_poker_template',[pokerTemplateToDCPInsert(pt)]);
    dataMaster.invoke('dcpregistry/registerTemplate',{templateName:pt.name,registryelementpath:['cluster'],availabilityfunc:availabilityFunc,searchfunc:templateSearch,newfunc:newTemplateInstance});
    res.jsonp(pt);
  });
};

PokerTemplate.find({},function(err,pts){
  for(var i in pts){
    var pt = pts[i];
    dataMaster.invoke('dcpregistry/registerTemplate',{templateName:pt.name,registryelementpath:['cluster','nodes'],availabilityfunc:availabilityFunc,searchfunc:templateSearch,newfunc:newTemplateInstance});
  }
});

exports.all = function(req,res) {
  PokerTemplate.find({},function(err,pts){
    res.jsonp(pts);
  });
};
