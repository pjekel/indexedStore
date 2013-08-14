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

var profile = (function () {
	return {
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
            "config-deferredInstrumentation": 0,
            "config-dojo-loader-catches": 0,
            "config-tlmSiblingOfDojo": 0,
            "dojo-amd-factory-scan": 0,
            "dojo-combo-api": 0,
            "dojo-config-api": 1,
            "dojo-config-require": 0,
            "dojo-debug-messages": 0,
            "dojo-dom-ready-api": 1,
            "dojo-has-api": 1,
            "dojo-inject-api": 1,
            "dojo-loader": 1,
            "dojo-log-api": 0,
            "dojo-modulePaths": 0,
            "dojo-moduleUrl": 0,
            "dojo-publish-privates": 0,
            "dojo-sniff": 0,
            "dojo-sync-loader": 0,
            "dojo-test-sniff": 0,
            "dojo-trace-api": 0,
            "dojo-undef-api": 0,
            "dojo-v1x-i18n-Api": 1,
            "dom": 1,
            "host-browser": 1,
            "extend-dojo": 1
		},

		packages:[
			{name:"dojo", location: "dojo"},
			{name:"store", location: "indexedStore"}
		],

		layers: {
			"store/indexedStore": {
				copyright:"copyright.txt",
				include: [
					"store/_base/_assert",
					"store/_base/_Indexed",
					"store/_base/_Loader",
					"store/_base/_Natural",
					"store/_base/_Procedures",
					"store/_base/_RestAPI",
					"store/_base/_Trigger",
					"store/_base/_Store",
					"store/_base/Cursor",
					"store/_base/Directives",
					"store/_base/Eventer",
					"store/_base/FeatureList",
					"store/_base/Index",
					"store/_base/KeyRange",
					"store/_base/Keys",
					"store/_base/library",
					"store/_base/Location",
					"store/_base/Observer",
					"store/_base/range",
					"store/_base/Record",
					"store/_base/Watcher",

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
					"store/extension/WebStorage",

					"store/listener/Actions",
					"store/listener/Listener",
					"store/listener/ListenerList",

					"store/loader/_fixError",
					"store/loader/_LoadDeferred",
					"store/loader/_LoaderBase",
					"store/loader/_LoadManager",
					"store/loader/_LoadRequest",
					"store/loader/Advanced",
					"store/loader/Basic",
					"store/loader/Rest",
					"store/loader/handler/csvHandler",
					"store/loader/handler/ifrsHandler",
					"store/loader/handler/register",

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
					"store/util/sorter"
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
})();