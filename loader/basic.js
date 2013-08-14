//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../_base/library",
		"../error/createError!../error/StoreErrors.json",
		"./_LoadDeferred",
		"./_LoaderBase"
	], function (lib, createError, LoadDeferred, LoaderBase) {
	"use strict";

	// module
	//		indexedStore/loader/Basic
	// summary:
	//		Implements the Basic data loader. This loader is used if only in-memory
	//		objects are to be loaded. If loading data using URL's or Web Storage is
	//		required use the Advanced loader instead.
	// interface:
	//		[Constructor(Store store, LoadDirectives kwArgs)]
	//		interface LoaderBasic : LoaderBase {
	//		}
	//
	//		dictionary LoadDirectives {
	//				...
	//		}
	//
	// example:
	//		The indexedStore loaders are normally instantiated using the plug-in
	//		class _Loader (indexedStore/_base/_Loader)
	//
	//	|	require(["dojo/_base/declare",
	//	|	         "store/_base/_Store",
	//	|	         "store/_base/_Indexed",
	//	|	         "store/_base/_Loader!Basic",
	//	|	                   ...
	//	|	        ], function (declare, _Store, _Indexed, _Loader, ... ) {
	//	|
	//	|	    var StoreClass = declare([_Store, _Indexed, _Loader]);
	//	|	    var myStore = new StoreClass({data: myData, keyPath: "name"});
	//	|	                   ...
	//	|	});


	var StoreError = createError("Loader");		// Create the StoreError type.

	// Define the additional load directives supported by this loader.
	var privateDirectives = {
		// data: any
		//		Data object. If handleAs is not specified data must be an array
		//		of objects. However, the store put no constraints on the type of
		//		objects. (See also the 'handleAs' property).
		data: null
	};

	function LoaderBasic(store, kwArgs) {
		// summary:
		//		Basic loader constructor
		// store: Store
		// storeArgs: Object
		// tag:
		//		public

		LoaderBase.call(this, store, "basic", kwArgs);

		this._getData = function (request) {
			// summary:
			//
			// request: LoadRequest
			// returns: Promise
			//		A dojo/request style promise. The promise has an additional
			//		property not found on standard promises: response.
			// tag:
			//		private
			var data = request.directives.data;
				// Mimic a dojo/request result.
			var response = {text: data, data: data, status: 200};
			var deferred = new LoadDeferred();

			deferred.resolve(response);
			return deferred.promise;
		};

		this._storeData = function (request, response) {
			// summary:
			//		Load an array of data objects into the store.
			// request: LoadRequest
			// response: Object
			// options: LoadDirectives
			//		A JavaScript key:value pairs object. The object properties define
			//		additional directives for the load process.
			// tag:
			//		private
			var i, max;
			var options = request.directives;
			var flags   = options.overwrite ? {overwrite: true} : null;
			var store   = this.store;
			var data    = response.data || [];
			var stored  = [];

			max = data.length;

			if (data instanceof Array) {
				store._trigger("preload", data, options);
				try {
					for (i = 0; i < max; i++) {
						store._storeRecord(data[i], flags);
						stored.push(data[i]);
					}
					store._trigger("postload", stored, options, 0);
				} catch (err) {
					store._trigger("postload", stored, options, 1);
					throw err;
				}
			} else {
				throw new StoreError("DataError", "_loadData", "store data must be an array of objects");
			}
			return true;
		};

		this._directives.declare(privateDirectives, kwArgs);
		this.features.add("data", true);

		lib.protect(this);

	} /* end Advanced() */

	LoaderBasic.prototype = new LoaderBase();
	LoaderBasic.prototype.constructor = LoaderBasic;

	return LoaderBasic;
});
