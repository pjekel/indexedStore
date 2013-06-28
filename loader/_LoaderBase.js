//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/Deferred",
		"dojo/request/handlers",
		"../_base/library",
		"../dom/event/Event",
		"../error/createError!../error/StoreErrors.json",
		"./_LoadDeferred"
	], function (Deferred, handlers, lib, Event, createError, LoadDeferred) {
	"use strict";

	// module
	//		indexedStore/loader/Default
	// summary:
	//		This module implements the basic store loader.  This particular loader
	//		only support the loading of memory objects and serves as the defaults
	//		store loader. For more enhanced features, including loading data using
	//		a URL, please refer to:
	//
	//			indexedStore/_base/_Loader
	//			indexedStore/loader/LoaderPlus

	var StoreError = createError("Loader");		// Create the StoreError type.
	var isObject   = lib.isObject;
	var clone      = lib.clone;
	var mixin      = lib.mixin;

	var LoadDirectives = {
		// data: Array
		//		An array of objects to be loaded into the store.
		data: null,

		// overwrite: Boolean
		//		If true, overwrite store objects if objects with the same key
		//		already exist, otherwise an exception of type ConstraintError
		//		is thrown.
		overwrite: false
	};

	function Loader(store) {
		// summary:
		//		The primordial store loader.
		// store: Store
		//		Instance of a Store object

		var canceled = false;
		var loader   = this;

		function loadError(err, defer) {
			// summary:
			// err: Error
			//		Error condition, typically an instance of Error
			// tag:
			//		private
			store._trigger("loadFailed");
			store.dispatchEvent(new Event("error", {error: err, bubbles: true, cancelable: true}));
			defer.reject(err);

			defer.error  = err;
			loader.error = err;
		}

		this.cancel = function (reason) {
			canceled = true;
		};

		this.load = function (options) {
			// summary:
			//		Load an array of JavaScript key:value pairs objects into the
			//		store.
			// options: Object?
			//		Optional Loader Directives
			// returns: dojo/promise/Promise
			//		The promise returned has an extra property not found on standard
			//		promises: response. The response property is a normal promise that
			//		is resolved with an object representing the response from the server.
			// tag:
			//		public
			var flags, data, ldrDef, loaded, response;
			options  = mixin(clone(LoadDirectives), options);
			flags    = options.overwrite ? {overwrite: true} : null;
			ldrDef   = new LoadDeferred();
			canceled = false;
			loaded   = [];

			// Mimic a server style response.
			response = {text: options.data || [], options: {handleAs: options.handleAs}};
			data     = handlers(response).data;

			if (data instanceof Array) {
				var i, max = data.length;
				// Temporarily install an error event handler
				loader.loading = ldrDef.promise;
				store._trigger("loadStart");
				try {
					for (i = 0; i < max && !canceled; i++) {
						store._storeRecord(data[i], flags);
						loaded.push(data[i]);
					}
					loader.loading = false;
					loader.count++;
					store._trigger("loadEnd");
					ldrDef.response = {text: data, data: loaded, status: 200};
					ldrDef.resolve(ldrDef.response);
				} catch (err) {
					loader.loading  = false;
					ldrDef.response = {text: data, data: loaded, status: 500};
					loadError(StoreError.call(err, err, "load"), ldrDef);
				}
			} else {
				throw new StoreError("DataError", "load", "data must be an array of objects");
			}
			return ldrDef.promise;
		};

		// Public properties
		this.loading = false;
		this.error   = null;
		this.type    = "basic";
		this.count   = 0;
	} /* end Loader() */

	return Loader;

});	/* end define() */
