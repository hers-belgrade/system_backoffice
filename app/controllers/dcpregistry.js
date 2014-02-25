var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var errors = {
  'OK' : {message:'Counter for [templateName] is [counter]',params:['counter','templateName']},
  'TEMPLATE_NOT_REGISTERED' : {message:'Template name [templateName] is not registered',params:['templateName']},
  'TEMPLATE_INSTANCE_NOT_REVOKED' : {message:'Instance [instanceName] could not be revoked for template name [templateName]', params:['templateName','instanceName']},
  'UNDEFINED' : {message:'Template name [templateName] could not be resolved at the time',params:['templateName']}
};

var counters = {};

function registerTemplate(paramobj,statuscb){//templateName,registryelementpath,availabilityfunc,searchfunc){
  if(!paramobj.templateName){
    return cb('NO_TEMPLATE_NAME');
  }
  this.self.templates[paramobj.templateName] = {
    find:(function(_t,po){
      var _this = _t;
      return function(searchobj,username,realmname){
        var templateName = searchobj.templateName,
          registryelementpath = po.registryelementpath || [],
          availabilityfunc = po.availabilityfunc || function(){return true;},
          searchfunc = po.searchfunc || function(el,name){return el.element([name])},
          newfunc = po.newfunc || function(el,name){
            el.commit('new_resource',[
              ['set',[name]]//,'dcp']
            ]);
          };
        var datael = _this.self.targetdata.element(registryelementpath);
        if(!datael){
          console.log('no element on',registryelementpath);
          return;
        }
        var ret=1, resourceel, elname;
        while(true){
          elname = templateName+ret;
          //console.log('Trying',elname);
          resourceel = searchfunc(datael,elname,searchobj,username,realmname);
          //console.log('got',resourceel);
          if(!resourceel){
            newfunc(datael,elname,searchobj,username,realmname);
            resourceel = searchfunc(datael,elname,searchobj,username,realmname);
            if(!resourceel){return;}
          }
          if(availabilityfunc(resourceel,elname,searchobj,username,realmname)){
            return elname;
          }
          ret++;
        }
      };
    })(this,paramobj),
    revoke:(function(_t,po){
      var _this = _t;
      return function(searchobj,username,realmname){
        var templateName = searchobj.templateName,
          instanceName = searchobj.instanceName,
          registryelementpath = po.registryelementpath || [],
          searchfunc = po.searchfunc || function(el,name){return el.element([name])},
          deletefunc = po.deletefunc || function(el,name){el.remove(name);};
        var datael = _this.self.targetdata.element(registryelementpath);
        if(!datael){
          console.log('no element on',registryelementpath);
          return;
        }
        resourceel = searchfunc(datael,instanceName,searchobj,username,realmname);
        if(resourceel){
          deletefunc(datael,instanceName,searchobj,username,realmname);
          return true;
        }else{
          console.log('No template for',instanceName,'on',datael.dataDebug());
        }
      };
    })(this,paramobj)
  };
};
registerTemplate.params = 'originalobj';

function newNameForTemplate(paramobj,statuscb,username,realmname){
  var templateName = paramobj.templateName;
  if(!templateName){
    return statuscb('NO_TEMPLATE_NAME');
  }
  if(!this.self.templates[templateName]){
    return statuscb('TEMPLATE_NOT_REGISTERED',templateName);
  }
  var ret = this.self.templates[templateName].find(paramobj,username,realmname);
  if(ret){
    return statuscb('OK',ret,templateName);
  }else{
    return statuscb('UNDEFINED',templateName);
  }
};
newNameForTemplate.params='originalobj';

function revokeNameForTemplate(paramobj,statuscb,username,realmname){
  var templateName = paramobj.templateName;
  if(!templateName){
    return statuscb('NO_TEMPLATE_NAME');
  }
  if(!this.self.templates[templateName]){
    return statuscb('TEMPLATE_NOT_REGISTERED',templateName);
  }
  var rr = this.self.templates[templateName].revoke(paramobj,username,realmname);
  if(rr){
    return statuscb('OK',undefined,templateName);
  }
  return statuscb('TEMPLATE_INSTANCE_NOT_REVOKED',templateName,paramobj.instanceName);
};
revokeNameForTemplate.params='originalobj';

function init(){
  this.self.targetdata = this.self.targetdata || this.data;
  this.self.templates = {};
}


module.exports = {
  errors:errors,
  init:init,
  registerTemplate:registerTemplate,
  newNameForTemplate:newNameForTemplate,
  revokeNameForTemplate:revokeNameForTemplate
};
