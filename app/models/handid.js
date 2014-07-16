var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  HandIdPlayer = require('./handarchiveplayer');

var HandIdSchema = new Schema({
  created: {
    type: Date,
    default: Date.now
  },
  server: {
    type: String
  },
  gameclass: {
    type: String
  },
  template: {
    type: String
  },
  room: {
    type: String
  },
  players: [HandIdPlayer]
});

mongoose.model('HandId', HandIdSchema);
