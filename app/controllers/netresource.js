var __Managers = {};

function NetResourceManager(name){
  __Managers[name] = this;
  this.name = name;
};
NetResourceManager.prototype.resolve = function(requester){
};


module.exports = NetResource;
