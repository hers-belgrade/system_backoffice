var mongoose = require('mongoose'),
Schema = mongoose.Schema;

var SlotTemplateSchema = new Schema({
  name: {
    type: String,
    unique: true
  },
  class: String,
  columns: Number,
  rows: Number,
  double_up_prob: Number,
  max_bet_per_line: Number,
  max_paylines: Number,
  symbolweightsmults: String,
});
mongoose.model('SlotTemplate', SlotTemplateSchema);
