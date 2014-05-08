var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

module.exports = Schema({
  fullName:{type:String},
  balance:{type:Number},
  ordinal:{type:Number}
});


