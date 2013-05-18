//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define(["dojo/_base/lang",
				"dojo/Deferred",
				"./Library",
				"../error/createError!../error/StoreErrors.json",
			 ], function (lang, Deferred, Lib, createError) {

	// module
	//		indexedStore/_base/LoaderBase
	// summary:
	//		This module implements the basic store loader.  This particular loader
	//		only support the loading of memroy objects and serves as the defaults
	//		store loader. For more enhanced features, including loading data using
	//		a URL, please refer to:
	//
	//			indexedStore/_base/LoaderPlus

	var StoreError = createError("Loader");		// Create the StoreError type.
	var isObject   = Lib.isObject;
	var clone      = Lib.clone;

	var LoadDirectives = { 
		// data: Array
		//		The array of all raw objects to be loaded in the memory store.
		data: null, 

		// overwrite: Boolean
		//		If true, overwrite store objects if objects with the same key already
		//		exist, otherwise an exception of type ConstraintError is thrown.
	  overwrite: false
	};

	function Loader (store) {
		// summary:
		//		The primordial store loader.
		// store: Store
		//		Instance of a Store object

		this.load = function (options) {
			// summary:
			//		Load an array of JavaScript key:value pairs objects into the store.
			// options: Object?
			// returns: dojo/promise/Promise
			// tag:
			//		public
			var options = lang.mixin( clone(LoadDirectives), options );
			var flags   = options.overwrite ? {overwrite:true} : null;
			var data    = options.data || [];
			var ldrDef  = new Deferred();
			
			if (data instanceof Array) {
				var i, max = data.length;

				loader.loading = ldrDef.promise;
				store._listeners.trigger("loadStart");
				try {
					for (i=0; i<max; i++) {
						store._storeRecord( data[i], flags );
					}
					loader.loading = false;
					store._listeners.trigger("loadEnd");
					ldrDef.resolve(store);
				} catch (err) {
					loader.loading = false;
					loader.error   = err;
					store._listeners.trigger("loadFailed");
					ldrDef.reject(err);
				}
			} else {
				throw new StoreError("DataError", "load", "data must be an array of objects");
			}
			return ldrDef.promise;
		}

		var loader = this;

		// Public properties
		this.loading = false;
		this.error   = null;

	} /* end Loader() */

	return Loader;

});	/* end define() */
