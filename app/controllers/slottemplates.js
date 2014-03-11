var mongoose = require('mongoose'),
    _ = require('underscore'),
    SlotTemplate = mongoose.model('SlotTemplate'),
    dataMaster = require('./datamaster');

function slotTemplateToDCPInsert(pt){
  var to = pt.toObject();
  delete to.__v;
  delete to._id;
  return ['set',['cluster_interface','templates','slotgames',to.name],[JSON.stringify(to),undefined,'dcp']];
}

SlotTemplate.find({},function(err,pts){
  var actions = [
    ['set',['cluster_interface','templates'],'dcp'],
    ['set',['cluster_interface','templates','slotgames'],'dcp']
  ];
  for(var i in pts){
    actions.push(slotTemplateToDCPInsert(pts[i]));
  }
  dataMaster.commit('slot_templates_init',actions);
});

function templateSearch(el,name,searchobj){
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
  el.commit('new_slottemplate_instance',[
		['set',[username]],
		['set',[username, 'server']],
		['set',[username, 'server', 'rooms']],
    ['set',[username,'server','rooms',name]],
    ['set',[username,'server','rooms',name,'brand_new'],[true]]
  ]);
  console.log('new slot template',username,el.element([username]).dataDebug());
};

function deleteTemplateInstance(el,name,searchobj,username,realmname){
  el.commit('slottemplate_instance_out',[
    ['remove',[username,'server','rooms',name]]
  ]);
};

function availabilityFunc(tplel,name,searchobj,username,realmname){
  console.log('slotTemplate availability',username,realmname);
  //console.log('availability of',tplel.element([username,'server','rooms']).dataDebug(),'for',name,'?');
  var ret = !!tplel.element([username,'server','rooms',name,'brand_new']);
  if(ret){
    if(!tplel.element([username,'status']).value()==='connected'){
      return true;
    }
    tplel.commit('engage_new_slottemplate_instance',[
      ['remove',[username,'server','rooms',name,'brand_new']]
    ]);
  }
  return ret;
};

exports.save = function(req, res) {
  var pt = new SlotTemplate(req.body);
  var pto = pt.toObject();
  delete pto._id;
  delete pto.name;
  SlotTemplate.findOneAndUpdate({name:req.body.name},pto,{upsert:true,new:true},function(err,pt){
    if(err){
      res.send(err);
      return;
    }
    dataMaster.commit('new_slot_template',[slotTemplateToDCPInsert(pt)]);
    dataMaster.element(['cluster_interface']).functionalities.dcpregistry.f.registerTemplate({templateName:pt.name,registryelementpath:['cluster','nodes'],availabilityfunc:availabilityFunc,searchfunc:templateSearch,newfunc:newTemplateInstance,deletefunc:deleteTemplateInstance});
    res.jsonp(pt);
  });
};

SlotTemplate.find({},function(err,pts){
  for(var i in pts){
    var pt = pts[i];
    dataMaster.element(['cluster_interface']).functionalities.dcpregistry.f.registerTemplate({templateName:pt.name,registryelementpath:['cluster','nodes'],availabilityfunc:availabilityFunc,searchfunc:templateSearch,newfunc:newTemplateInstance,deletefunc:deleteTemplateInstance});
  }
});

exports.all = function(req,res) {
  SlotTemplate.find({},function(err,pts){
    res.jsonp(pts);
  });
};
