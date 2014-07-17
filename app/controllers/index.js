/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    _ = require('underscore');


/*
exports.render = function(req, res) {
  res.render('index', {
user: req.user ? JSON.stringify(req.user) : "null"
});
};
*/

function viewForUser(req){
  var user = req.user;
  if(!(req.isAuthenticated()&&user&&user.roles)){return 'login';}
  var roles = user.roles.split(',');
  if(roles.indexOf('player')>=0){return 'play';}
  if(roles.indexOf('admin')>=0){return 'index';}
}

exports.render = function(req, res) {
  res.render(viewForUser(req), {
    user: req.user ? JSON.stringify(req.user) : "null"
  });
};

