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
  console.log('pt init',dataMaster.dataDebug());
});


exports.save = function(req, res) {
  PokerTemplate.findOneAndUpdate({name:req.body.name},req.body,{upsert:true,new:true},function(err,pt){
    if(err){
      res.send(err);
      return;
    }
    dataMaster.commit('new_poker_template',[pokerTemplateToDCPInsert(pt)]);
    res.jsonp(pt);
  });
};

exports.all = function(req,res) {
  PokerTemplate.find({},function(err,pts){
    res.jsonp(pts);
  });
};
