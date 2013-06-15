//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define(["dojo/Deferred",
				"./Library",
				"../dom/event/Event",
				"../error/createError!../error/StoreErrors.json"
			 ], function (Deferred, Lib, Event, createError) {

	// module
	//		indexedStore/_base/LoaderBase
	// summary:
	//		This module implements the basic store loader.  This particular loader
	//		only support the loading of memroy objects and serves as the defaults
	//		store loader. For more enhanced features, including loading data using
	//		a URL, please refer to:
	//
	//			indexedStore/_base/_Loader
	//			indexedStore/_base/LoaderPlus

	var StoreError = createError("Loader");		// Create the StoreError type.
	var isObject   = Lib.isObject;
	var clone      = Lib.clone;
	var mixin      = Lib.mixin;

	var LoadDirectives = { 
		// data: Array
		//		An array of objects to be loaded into the store.
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

		function loadError (err, defer) {
			// summary:
			// err: Error
			//		Error condition, typeically an instance of Error
			// tag:
			//		private
			store._trigger("loadFailed");
			store.dispatchEvent( new Event("error", {error:err, bubbles:true, cancelable:true}));
			defer.reject(err);
		}

		this.cancel = function (reason) {
			canceled = true;
		};
		
		this.load = function (options) {
			// summary:
			//		Load an array of JavaScript key:value pairs objects into the store.
			// options: Object?
			// returns: dojo/promise/Promise
			// tag:
			//		public
			var options = mixin( clone(LoadDirectives), options );
			var flags   = options.overwrite ? {overwrite:true} : null;
			var data    = options.data || [];
			var ldrDef  = new Deferred();

			canceled = false;

			if (data instanceof Array) {
				var i, max = data.length;
				// Temporarily install an error event handler
				loader.loading = ldrDef.promise;
				store._trigger("loadStart");
				try {
					for (i=0; i<max && !canceled; i++) {
						store._storeRecord( data[i], flags );
					}
					loader.loading = false;
					loader.count++;
					store._trigger("loadEnd");
					ldrDef.resolve(store);
				} catch (err) {
					loader.loading = false;
					loader.error   = err;
					loadError( StoreError.call(err, err, "load"), ldrDef );
				}
			} else {
				throw new StoreError("DataError", "load", "data must be an array of objects");
			}
			return ldrDef.promise;
		};

		var canceled = false;
		var loader   = this;

		// Public properties
		this.loading = false;
		this.error   = null;
		this.count   = 0;

	} /* end Loader() */

	return Loader;

});	/* end define() */
