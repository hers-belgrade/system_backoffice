var mongoose = require('mongoose'),
    _ = require('underscore'),
    PokerTemplate = mongoose.model('PokerTemplate'),
    dataMaster = require('./datamaster'),
    Templater = require('./common/templates.js');

var instance = new Templater({
  template_class: 'pokerroom'
  ,model: PokerTemplate
  ,dataMaster:dataMaster
});

instance.initialize();
instance.doexport(exports)
