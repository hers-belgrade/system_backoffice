var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var ServerLeaseSchema = new Schema({
  name: String,
  address: String,
  port: Number,
  type: String,
  realm: String
});

mongoose.model('ServerLease',ServerLeaseSchema);
