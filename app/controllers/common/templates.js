function insertToDCP(pt){
  var to = pt.toObject();
  delete to.__v;
  delete to._id;
  return ['set',['cluster_interface','templates',this.template_class,to.name],[JSON.stringify(to),undefined,'dcp']];
}

function removeFromDCP(pt) {
  return ['remove', ['cluster_interface', 'templates', this.template_class, pt.name]];
}

function templateSearch(self) {
  return function (el,name,searchobj){
    var te = self.roomMap[searchobj.templateName];
    if(!te){
      te = {};
      self.roomMap[searchobj.templateName] = te;
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
  }
};

function newTemplateInstance(self) {
  return function (el,name,searchobj,username,realmname){
    ///cache for now ...
    return self.roomMap[searchobj.templateName][name] = {server:username,brand_new:true};

    if(!el.element([username,'server','rooms'])){return;}
    el.commit('new_pokertemplate_instance',[
      ['set',[username,'server','rooms',name]],
      ['set',[username,'server','rooms',name,'brand_new'],[true]]
    ]);
    console.log('new pokerroom template',username,el.element([username]).dataDebug());
  }
};

function deleteTemplateInstance (self) {
  return function (el,name,searchobj,username,realmname){
    delete self.roomMap[searchobj.templateName][name];
    return;
    el.commit('pokertemplate_instance_out',[
      ['remove',[username,'server','rooms',name]]
    ]);
  }
};

function availabilityFunc(self) {
  return function (tplel,name,searchobj,username,realmname){
    var tn = searchobj.templateName;
    var el = self.roomMap[tn] && roomMap[tn][name];
    var ret = (el.server===username && el.brand_new);
    if(ret){
      delete el.brand_new;
      return self.dataMaster.element(['cluster','nodes',username,'status']).value()==='connected';
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
  }
};




function Templater (config) {
  config = config || {};
  if (!config.template_class) throw "Missing template class, can not move on ...";
  if (!config.model) throw "Missing template mongoose model, can not move on ...";
  if (!config.dataMaster) throw "Missing dataMaster, can not move on ...";


  this.template_class = config.template_class;
  this.model = config.model;
  this.dataMaster = config.dataMaster;

  this.roomMap = {};
}

Templater.prototype.initialize = function () {
  var self = this;
  this.model.find({},function(err,pts){
    var actions = [
      ['set',['cluster_interface','templates'],'dcp'],
      ['set',['cluster_interface','templates',self.template_class],'dcp']
    ];
    for(var i in pts){ actions.push(insertToDCP.call(self, pts[i])); }
    self.dataMaster.commit('templates_init',actions);

    for(var i in pts){
      var pt = pts[i];
      self.dataMaster.element(['cluster_interface']).functionalities.dcpregistry.registerTemplate({
        templateName:pt.name,registryelementpath:['cluster','nodes'],
        availabilityfunc:availabilityFunc(self),
        searchfunc:templateSearch(self),
        newfunc:newTemplateInstance(self),
        deletefunc:deleteTemplateInstance(self)
      });
    }
  });
}

Templater.prototype.templateName = function (req, res, next, name) {
  (this.model).findOne({name:name}, function (err, tpl) {
    if (err) return next(err);
    req.templateForName = tpl;
    next();
  });

}
Templater.prototype.remove = function (req, res) {
  var t = req.templateForName;
  var self = this;
  t.remove(function (err) {
    if (err) {
      res.render('error', {status:500});
    }else{
      self.dataMaster.commit ('removing_poker_template', [removeFromDCP.call(self, t)]);
      self.dataMaster.element(['cluster_interface']).functionalities.dcpregistry.unregisterTemplate({templateName:t.name});
      res.jsonp(t);
    }
  });
}

Templater.prototype.save = function(req, res) {
  var pt = new (this.model)(req.body);
  var pto = pt.toObject();
  delete pto._id;
  delete pto.name;
  var self = this;
  this.model.findOneAndUpdate({name:req.body.name},pto,{upsert:true,new:true},function(err,pt){
    if(err){
      res.send(err);
      return;
    }
    self.dataMaster.commit('new_poker_template',[insertToDCP.call(self, pt)]);
    self.dataMaster.element(['cluster_interface']).functionalities.dcpregistry.registerTemplate({
      templateName:pt.name,registryelementpath:['cluster','nodes'],
      availabilityfunc:availabilityFunc(self),
      searchfunc:templateSearch(self),
      newfunc:newTemplateInstance(self),
      deletefunc:deleteTemplateInstance(self)
    });
    res.jsonp(pt);
  });
};

Templater.prototype.all = function (req, res) {
  (this.model).find({},function(err,pts){ res.jsonp(pts); }); 
}

function bring_back (self, what) {
  if (!self[what]) throw "Missing : "+what;
  return function () { self[what].apply(self, arguments); }
}

Templater.prototype.doexport = function (ret) {
  ret = ret || {};
  ['all', 'save', 'remove', 'templateName'].forEach (function (v) {
    ret[v] = bring_back(this, v);
  }, this);
  return ret;
}

module.exports = Templater;
