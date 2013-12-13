var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var errors = {
  'OK' : {message:'Counter for [templateName] is [counter]',params:['counter','templateName']}
};

var counters = {};

function newNameForTemplate(templateName,statuscb,username,realmname){
  var cnt = counters[templateName];
  if(!cnt){
    cnt = [];
    counters[templateName] = cnt;
  }
  var c = 1;
  for(var i in cnt){
    if(cnt[i]>c){
      break;
    }else{
      c++;
    }
  }
  cnt.push(c);
  cnt.sort(function(a,b){return a-b;});
  return statuscb('OK',c,templateName);
}
newNameForTemplate.params=['templateName'];

function init(){
}


module.exports = {
  errors:errors,
  init:init,
  newNameForTemplate:newNameForTemplate
};
