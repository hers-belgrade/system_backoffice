var hersdata = require('hersdata'),
    dataMaster = new (hersdata.DataMaster)();

dataMaster.fingerprint = (require('crypto').randomBytes)(12).toString('hex');
dataMaster.createSuperUser('_central','_central');
dataMaster.setSessionUserFunctionality({realmName:'_central'});

module.exports = dataMaster;


