var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

module.exports = Schema({
  name:{type:String},
  realm:{type:String},
  balance:{type:Number},
  ordinal:{type:Number}
});


