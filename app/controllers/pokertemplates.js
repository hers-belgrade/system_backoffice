var mongoose = require('mongoose'),
    _ = require('underscore'),
    PokerTemplate = mongoose.model('PokerTemplate'),
    dataMaster = require('./datamaster'),
    roomMap = {};

function pokerTemplateToDCPInsert(pt){
  var to = pt.toObject();
  delete to.__v;
  delete to._id;
  return ['set',['cluster_interface','templates','pokerroom',to.name],[JSON.stringify(to),undefined,'dcp']];
}

PokerTemplate.find({},function(err,pts){
  var actions = [
    ['set',['cluster_interface','templates'],'dcp'],
    ['set',['cluster_interface','templates','pokerroom'],'dcp']
  ];
  for(var i in pts){
    actions.push(pokerTemplateToDCPInsert(pts[i]));
  }
  dataMaster.commit('poker_templates_init',actions);
});

function templateSearch(el,name,searchobj){
  var te = roomMap[searchobj.templateName];
  if(!te){
    te = {};
    roomMap[searchobj.templateName] = te;
  }
  return te[name];
  //console.log('is there any',el.dataDebug());
  var ret;
  el.traverseElements(function(_name,_el){
    if(_el.element(['server','rooms',name])){
      ret = el;
      return true;
    }
  });
  return ret;
};

function newTemplateInstance(el,name,searchobj,username,realmname){
  return roomMap[searchobj.templateName][name] = {server:username,brand_new:true};
  console.log('new pt',name,username,el.dataDebug());
  if(!el.element([username,'server','rooms'])){return;}
  el.commit('new_pokertemplate_instance',[
    ['set',[username,'server','rooms',name]],
    ['set',[username,'server','rooms',name,'brand_new'],[true]]
  ]);
  console.log('new pokerroom template',username,el.element([username]).dataDebug());
};

function deleteTemplateInstance(el,name,searchobj,username,realmname){
  delete roomMap[searchobj.templateName][name];
  return;
  el.commit('pokertemplate_instance_out',[
    ['remove',[username,'server','rooms',name]]
  ]);
};

function availabilityFunc(tplel,name,searchobj,username,realmname){
  var tn = searchobj.templateName;
  var el = roomMap[tn] && roomMap[tn][name];
  var ret = (el.server===username && el.brand_new);
  if(ret){
    delete el.brand_new;
    return dataMaster.element(['cluster','nodes',username,'status']).value()==='connected';
  }
  return ret;
  //console.log('availability of',tplel.element([username,'server','rooms']).dataDebug(),'for',name,'?');
  var ret = !!tplel.element([username,'server','rooms',name,'brand_new']);
  if(ret){
    if(!tplel.element([username,'status']).value()==='connected'){
      return true;
    }
    tplel.commit('engage_new_pokertemplate_instance',[
      ['remove',[username,'server','rooms',name,'brand_new']]
    ]);
  }
  return ret;
};

exports.save = function(req, res) {
  var pt = new PokerTemplate(req.body);
  var pto = pt.toObject();
  delete pto._id;
  delete pto.name;
  PokerTemplate.findOneAndUpdate({name:req.body.name},pto,{upsert:true,new:true},function(err,pt){
    if(err){
      res.send(err);
      return;
    }
    dataMaster.commit('new_poker_template',[pokerTemplateToDCPInsert(pt)]);
    dataMaster.element(['cluster_interface']).functionalities.dcpregistry.f.registerTemplate({templateName:pt.name,registryelementpath:['cluster','nodes'],availabilityfunc:availabilityFunc,searchfunc:templateSearch,newfunc:newTemplateInstance,deletefunc:deleteTemplateInstance});
    res.jsonp(pt);
  });
};

PokerTemplate.find({},function(err,pts){
  for(var i in pts){
    var pt = pts[i];
    dataMaster.element(['cluster_interface']).functionalities.dcpregistry.f.registerTemplate({templateName:pt.name,registryelementpath:['cluster','nodes'],availabilityfunc:availabilityFunc,searchfunc:templateSearch,newfunc:newTemplateInstance,deletefunc:deleteTemplateInstance});
  }
});

exports.all = function(req,res) {
  PokerTemplate.find({},function(err,pts){
    res.jsonp(pts);
  });
};
