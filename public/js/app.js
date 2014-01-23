angular.module('mean', ['ngCookies', 'ngResource', 'ui.bootstrap', 'ui.route', 'mean.system', 'mean.articles', 'mean.servers','mean.pokertemplates','mean.slottemplates','mean.charting','HERS']);

angular.module('mean.system', []);
angular.module('mean.articles', []);
angular.module('mean.servers', []);
angular.module('mean.pokertemplates', []);
angular.module('mean.slottemplates', ['hers.utils', 'ngGrid']);
angular.module('mean.charting', []);
