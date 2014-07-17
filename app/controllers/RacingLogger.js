var hersdata = require('hersdata'),
  executable = hersdata.executable,
  isExecutable = executable.isA,
  execCall = executable.call;

function RacingLogger(model){
  this.model = model;
  this.waiters = [];
  this.idpool = [];
};
RacingLogger.prototype.createId = function(){
  if(this.idpool.length){
    this.useId(this.idpool.shift());
    return;
  }
  var t = this;
  this.model.create({},function(err,m){
    if(err){
      console.log('mongo error',err);
      process.exit(0);
    }
    t.useId(m._id);
  });
};
RacingLogger.prototype.useId = function(id){
  var cb = this.waiters.shift();
  if(cb){
    execCall(cb,id);
  }else{
    if(!this._id){
      this._id = id;
    }else{
      this.idpool.push(id);
    }
  }
};
RacingLogger.prototype.getId = function(cb){
  if(!isExecutable(cb)){
    return;
  }
  if(this._id){
    var id = this._id;
    //console.log('will give out',id,'because',this._id);
    delete this._id;
    execCall(cb,id);
  }else{
    this.waiters.push(cb);
    this.createId();
  }
};
RacingLogger.prototype.saveId = function(id,data,cb){
  var t = this;
  //console.log('saving',data);
  this.model.findByIdAndUpdate(id,data,{select:[]},function(error,d){
    if(error){
      console.log('error in updating mongo',error);
      process.exit(0);
    }
    if(d){
      //console.log('saved data',d);
    }
    if(isExecutable(cb)){
      execCall(cb,d);
    }
    t.createId();
  });
};
RacingLogger.prototype.rollback = function(id){
  this.useId(id);
};

module.exports = RacingLogger;
