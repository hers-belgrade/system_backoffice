var hersdata = require('hersdata'),
    dataMaster = new (hersdata.DataMaster)();

var replicationPort = 16020;
    
dataMaster.fingerprint = (require('crypto').randomBytes)(12).toString('hex');
//dataMaster.setSessionUserFactory();
dataMaster.replicationPort = replicationPort;
dataMaster.openReplication(replicationPort);
dataMaster.attach(__dirname+'/dcpregistry',{});

module.exports = dataMaster;


