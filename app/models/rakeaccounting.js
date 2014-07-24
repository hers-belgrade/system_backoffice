var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  HandPlayerSchema = require('./handarchiveplayer');

var BreakdownSchema = new Schema({
  realm: String,
  name: String,
  usertype: String,
  rake: Number
});

var RakeSchema = new Schema({
  amount: Number,
  pot_title: String,
  pot_index: Number
})

/*
{ total: 36,
  breakdown: 
  [ { realm: 'ppw', name: 'saban', rake: 18 },
  { realm: 'ppw', name: 'zika', rake: 18 } ],
  records: [ { amount: 36, pot_title: 'main pot (764)', pot_index: 1 } ] }
  */

var RakeAccountingSchema = new Schema({
  created: {type:Date},
  handId: {type:String},
  total: Number,
  breakdown: [BreakdownSchema],
  records: [RakeSchema]
});

mongoose.model('RakeAccounting',RakeAccountingSchema);

