var hersdata = require('hersdata'),
  ArrayMap = hersdata.ArrayMap;

var errors = {
  'OK' : {message:'Counter for [templateName] is [counter]',params:['counter','templateName']},
  'TEMPLATE_NOT_REGISTERED' : {message:'Template name [templateName] is not registered',params:['templateName']},
  'TEMPLATE_INSTANCE_NOT_REVOKED' : {message:'Instance [instanceName] could not be revoked for template name [templateName]', params:['templateName','instanceName']},
  'INVALID_INSTANCE_NAME' : {message:'Instance name [instanceName] is not a name from template [templateName]',params:['instanceName','templateName']},
  'UNDEFINED' : {message:'Template name [templateName] could not be resolved at the time',params:['templateName']}
};

var counters = {};

function registerTemplate(paramobj,statuscb){//templateName,registryelementpath,availabilityfunc,searchfunc){
  if(!paramobj.templateName){
    return cb('NO_TEMPLATE_NAME');
  }
  var t = this.self.templates[paramobj.templateName];
  if(!t){
    t = new ArrayMap();
    this.self.templates[paramobj.templateName] = t;
  }
};
registerTemplate.params = 'originalobj';

function newNameForTemplate(paramobj,statuscb,user){
  var templateName = paramobj.templateName;
  if(!templateName){
    return statuscb('NO_TEMPLATE_NAME');
  }
  var t = this.self.templates[templateName];
  if(!t){
    return statuscb('TEMPLATE_NOT_REGISTERED',templateName);
  }
  var ret = templateName+(parseInt(t.add(true))+1);
  if(ret){
    return statuscb('OK',ret,templateName);
  }else{
    return statuscb('UNDEFINED',templateName);
  }
};
newNameForTemplate.params='originalobj';

function revokeNameForTemplate(paramobj,statuscb,user){
  var templateName = paramobj.templateName;
  if(!templateName){
    return statuscb('NO_TEMPLATE_NAME');
  }
  var t = this.self.templates[templateName];
  if(!t){
    return statuscb('TEMPLATE_NOT_REGISTERED',templateName);
  }
  var name = paramobj.instanceName;
  if(name.indexOf(templateName)!==0){
    return statuscb('INVALID_INSTANCE_NAME',name,templateName);
  }
  var index = parseInt(name.substr(templateName.length));
  if(isNaN(index)){
    return statuscb('INVALID_INSTANCE_NAME',name,templateName);
  }
  index--;
  console.log(templateName,'removing',index,'because',name);
  t.remove(index);
  return statuscb('OK',name,templateName);
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
