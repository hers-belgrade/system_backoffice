var hersdata = require('hersdata'),
  executable = hersdata.executable,
  isExecutable = executable.isA,
  dummy = executable.dummyFunc;

var errors = {
};

function _account(timestamp,handId,amount,klass,type,flavor,roomname,username,realm){
  this.offer({
    recordProfit:{
      offer:{
        data4json:{
          created:timestamp,
          handId:handId,
          handId:handId,
          klass:klass,
          type:type,
          flavor:flavor,
          room:roomname,
          username:username,
          realm:realm,
          amount:amount
        }
      }
    }
  },dummy,this.superUser);
};

function onProfitOffer(user,offer,originaloffer,acceptcb,offercb,refusecb){
  if(user.realmname()!==originaloffer.realm){
    refusecb('WRONG_REALM',user.realmname());
    return;
  }
  acceptcb();
};

function init(){
};

module.exports = {
  errors: errors,
  _account:_account,
  init: init,
  requirements:{
    recordProfit:{
      onOffer:onProfitOffer
    }
  }
};
