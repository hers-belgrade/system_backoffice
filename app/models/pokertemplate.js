var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var PokerTemplateSchema = new Schema({
  name:{
    type: String,
    unique: true
  },
  class: String,
  type: String,
  capacity: Number,
  bettingpolicy: String,
  fixedlimitvalue: Number,
  ante: Number,
  bigblind: Number,
  speed: String,
  flavor: String,
  timeoutValue: Number,
  bots: Number
});

mongoose.model('PokerTemplate',PokerTemplateSchema);
