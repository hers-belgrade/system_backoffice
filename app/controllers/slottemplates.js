var mongoose = require('mongoose'),
    _ = require('underscore'),
    SlotTemplate = mongoose.model('SlotTemplate'),
    dataMaster = require('./datamaster'),
    Templater = require('./common/templates.js');

var instance = new Templater({
  template_class:'slotgames'
  ,model: SlotTemplate
  ,dataMaster:dataMaster
});

instance.initialize();
instance.doexport(exports);
