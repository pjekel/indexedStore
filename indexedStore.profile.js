var testResourceRe = /^indexedStore\/tests\//;
var excludePath = [ /^indexedStore\/((.*)?\/)?tests\//,
									  /^indexedStore\/((.*)?\/)?demos\//,
									  /^indexedStore\/((.*)?\/)?json\//,
									  /^indexedStore\/((.*)?\/)?csv\//
									 ];
var copyOnly = function(filename, mid) {
	var list = {
		"store/indexedStore.profile":1,
		"store/package.json":1
	};
	return (mid in list);
};

// The following profile defines all dojo, dijit and indexedStore modules required
// to run all demos included in the CheckBox Tree package.

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
				"store/_base/_Natural",
				"store/_base/_Store",
				"store/_base/Cursor",
				"store/_base/FeatureList",
				"store/_base/Index",
				"store/_base/KeyRange",
				"store/_base/Keys",
				"store/_base/Library",
				"store/_base/Record",
				"store/_base/Transaction",
				"store/_base/TransactionMgr",
				"store/dom/event/Event",
				"store/dom/event/EventDefault",
				"store/dom/event/EventTarget",
				"store/dom/string/DOMStringList",
				"store/error/createError",
				"store/extension/_Path",
				"store/extension/_PathList",
				"store/extension/Ancestry",
				"store/extension/CORS",
				"store/extension/Hierarchy",
				"store/extension/Loader",
				"store/handler/csvHandler",
				"store/handler/ifrsHandler",
				"store/util/shim/Array",
				"store/util/QueryEngine"
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
