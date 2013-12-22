var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var errors = {
  'OK' : {message:'Counter for [templateName] is [counter]',params:['counter','templateName']},
  'TEMPLATE_NOT_REGISTERED' : {message:'Template name [templateName] is not registered',params:['templateName']}
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
        var templateName = po.templateName,
          registryelementpath = po.registryelementpath || [],
          availabilityfunc = po.availabilityfunc || function(){return true;},
          searchfunc = po.searchfunc || function(el,name){return el.element([name])};
          newfunc = po.newfunc || function(el,name){
            el.commit('new_resource',[
              ['set',[name],'dcp']
            ]);
          };
        var datael = _this.data.element(registryelementpath);
        if(!datael){
          console.log('no element on',registryelementpath);
          return;
        }
        var ret=1, resourceel, elname;
        while(true){
          elname = templateName+ret;
          resourceel = searchfunc(datael,elname,searchobj,username,realmname);
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
  var searchargs = [];
  return statuscb('OK',this.self.templates[templateName].find(paramobj,username,realmname),templateName);
}
newNameForTemplate.params='originalobj';

function init(){
  this.self.templates = {};
}


module.exports = {
  errors:errors,
  init:init,
  registerTemplate:registerTemplate,
  newNameForTemplate:newNameForTemplate
};
