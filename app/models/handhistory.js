var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  HandPlayerSchema = require('./handarchiveplayer');

var HandHistorySchema = new Schema({
  created: {type:Date},
  handId: {type:String},
  speed: {type:String},
  flavor: {type:String},
  capacity: {type:Number},
  bettingpolicy: {type:String},
  bigblind: {type:String},
  timeoutValue: {type:String},
  players: [HandPlayerSchema],
  events: []
});

mongoose.model('HandHistory',HandHistorySchema);
