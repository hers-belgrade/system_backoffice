var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var SingleGameEventSchema = new Schema({
  created: Date,
  handId: String,
  name: String,
  realm: String,
  eventcode: String,
  initial_balance: Number,
  balance: Number,
  win: Number,
  symbols: String,
  profit: Number
});

mongoose.model('SingleGameEvent',SingleGameEventSchema);

