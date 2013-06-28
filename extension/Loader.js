//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["require"], function (require) {
	"use strict";

	// module:
	//		indexedStore/extension/Loader
	// summary:
	//		dojo loader plugin to load the store loaders. This plugin is only provided
	//		as a convenience.  It allows the store loaders to be loaded using the same
	//		directory path as all other extensions.
	// example:
	//	|	required(["store/extension/Loader!basic",
	//	|						...
	//	|			 ], function (Loader, ... ) {
	//	|	});
	//
	//		The above example is functionally equivalent to:
	//
	//	|	required(["store/loader/basic",
	//	|						...
	//	|			 ], function (Loader, ... ) {
	//	|	});

	return {

		load: function (resource, amdRequire, loaded) {
			// summary:
			//		dojo loader plugin portion. Called by the dojo loader whenever the
			//		module identifier, "indexedStore/extension/Loader", is followed by
			//		an exclamation mark (!) and a resource string (loader type)
			// resource: String
			//		The resource string identifying the type of loader requested. For
			//		example: 'basic' or 'advanced'. If omitted the loader defaults to
			//		'basic'
			// require: Function
			//		AMD require function.
			// loaded: Function
			//		dojo loader callback function. Called by this plug-in loader when
			//		requested resource has been loaded.
			// tag:
			//		public

			var loaderURI = "../loader/" + (resource || "basic");
			if (loaderURI) {
				require([loaderURI], function (loader) {
					loaded(loader);
				});
			} else {
				loaded(null);
			}
		}

	};
});
