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
  var servs = el.keys();
  for(var i in servs){
    if(el.element([servs[i],'server','rooms',name])){
      return el;
    }
  }
};

function newTemplateInstance(el,name,searchobj,username,realmname){
  //console.log('new pt',name,username,el.dataDebug());
  el.commit('new_pokertemplate_instance',[
    ['set',[username,'server','rooms',name]],
    ['set',[username,'server','rooms',name,'brand_new'],[true]]
  ]);
  console.log('new pokerroom template',username,el.dataDebug());
};

function deleteTemplateInstance(el,name,searchobj,username,realmname){
  el.commit('pokertemplate_instance_out',[
    ['remove',[username,'server','rooms',name]]
  ]);
};

function availabilityFunc(tplel,name,searchobj,username,realmname){
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
    dataMaster.invoke('dcpregistry/registerTemplate',{templateName:pt.name,registryelementpath:['cluster','nodes'],availabilityfunc:availabilityFunc,searchfunc:templateSearch,newfunc:newTemplateInstance,deletefunc:deleteTemplateInstance});
    res.jsonp(pt);
  });
};

PokerTemplate.find({},function(err,pts){
  for(var i in pts){
    var pt = pts[i];
    dataMaster.invoke('dcpregistry/registerTemplate',{templateName:pt.name,registryelementpath:['cluster','nodes'],availabilityfunc:availabilityFunc,searchfunc:templateSearch,newfunc:newTemplateInstance,deletefunc:deleteTemplateInstance});
  }
});

exports.all = function(req,res) {
  PokerTemplate.find({},function(err,pts){
    res.jsonp(pts);
  });
};