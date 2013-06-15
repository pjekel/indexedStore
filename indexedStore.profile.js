var testResourceRe = /^store\/tests\//;
var excludePath = [ /^store\/((.*)?\/)?tests\//,
									  /^store\/((.*)?\/)?demos\//,
									  /^store\/((.*)?\/)?json\//,
									  /^store\/((.*)?\/)?csv\//
									 ];
var copyOnly = function(filename, mid) {
	var list = {
		"store/indexedStore.profile":1,
		"store/package.json":1
	};
	return (mid in list);
};

var profile = {
	releaseDir: "../release",
	releaseName: "indexedStore",
	basePath: "..",
	action: "release",
	cssOptimize: "comments",
	optimize: "closure",
	layerOptimize: "closure",
	selectorEngine: "acme",
	mini: true,

	staticHasFeatures: {
		"config-deferredInstrumentation": 0
	},

	packages:[
		{name:"dojo", location: "dojo"},
		{name:"dijit", location: "dijit"},
		{name:"store", location: "indexedStore"}	
	],

	layers: {
		"store/indexedStore": {
			include: [
				"store/_base/_Indexed",
				"store/_base/_Loader",
				"store/_base/_Natural",
				"store/_base/_Store",
				"store/_base/Cursor",
				"store/_base/Eventer",
				"store/_base/FeatureList",
				"store/_base/Index",
				"store/_base/KeyRange",
				"store/_base/Keys",
				"store/_base/Library",
				"store/_base/LoaderBase",
				"store/_base/LoaderPlus",
				"store/_base/Location",
				"store/_base/Observer",
				"store/_base/Range",
				"store/_base/Record",
				"store/dom/event/Event",
				"store/dom/event/EventDefaults",
				"store/dom/event/EventTarget",
				"store/dom/string/DOMStringList",
				"store/error/createError",
				"store/extension/_Path",
				"store/extension/_PathList",
				"store/extension/Ancestry",
				"store/extension/CORS",
				"store/extension/Eventable",
				"store/extension/Hierarchy",
				"store/extension/Observable",
				"store/extension/Watch",
				"store/listener/Actions",
				"store/listener/Listener",
				"store/listener/ListenerList",
				"store/shim/Array",
				"store/shim/Date",
				"store/shim/Object",
				"store/shim/shims",
				"store/transaction/_opcodes",
				"store/transaction/_Transaction",
				"store/transaction/_Transactional",
				"store/transaction/Manager",
				"store/util/QueryEngine",
				"store/util/QueryResults",
				"store/util/Sorter"
			]
		}
	},

	resourceTags: {
		test: function(filename, mid){
			var result = testResourceRe.test(mid);
			return testResourceRe.test(mid) || mid=="indexedStore/tests" || mid=="indexedStore/demos";
		},

		amd: function(filename, mid) {
			return !testResourceRe.test(mid) && !copyOnly(filename, mid) && /\.js$/.test(filename);
		},

		copyOnly: function(filename, mid) {
			return copyOnly(filename, mid);
		},

		miniExclude: function(filename, mid){
			var result = excludePath.some( function (regex) {
				return regex.test(mid);
			});
			return result;
		}
	}
};
