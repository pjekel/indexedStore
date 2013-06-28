//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/declare",
		"dojo/Deferred",
		"../_base/library",
		"../error/createError!../error/StoreErrors.json",
		"./_LoaderBase"
	], function (declare, Deferred, lib, createError, Loader) {

	// module:
	//		indexedStore/loader/basic
	// summary:
	//		Extend the store with basic load capability. A store loader consists
	//		of two parts:
	//
	//			1) A store extension and,
	//			2) The actual loader (./_LoaderBase).
	//
	//		This module is the store extension which adds the load() and setData()
	//		methods to the store and creates a new instance of the actual store
	//		loader.

	var StoreError = createError("Loader");		// Create the StoreError type.
	var isObject   = lib.isObject;
	var mixin      = lib.mixin;

	var _Loader = declare(null, {

		//=========================================================================
		// Constructor keyword arguments (LoadDirectives):

		// data: Array
		//		An array of objects to be loaded in the store.
		data: null,

		// handleAs: String
		handleAs: null,

		// overwrite: Boolean
		//		If true, overwrite store objects if objects with the same key already
		//		exist, otherwise an exception of type ConstraintError is thrown.
		//		This overwrite property only applies when loading data.
		//		(See also maxErrors)
		overwrite: false,

		//=========================================================================
		// Constructor

		constructor: function (kwArgs) {
			// summary:
			// kwArgs: Object?
			//		A JavaScript key:value pairs object
			//			{
			//				data: any?
			//				handleAs: String?,
			//				overwrite: Boolean?
			//			}

			if (this.features.has("hierarchy")) {
				throw new StoreError("Dependency", "constructor", "loader must be installed prior to any extension");
			}
			this.loader = new Loader(this);		// Overwrite default store loader.
			this.features.add("loaderBasic");
		},

		//=========================================================================
		// Public IndexedStore/api/store API methods

		load: function (options) {
			// summary:
			//		Load a set of objects into the store.
			// options: LoadDirectives?
			//		LoadDirectives, see (indexedStore/loader/_LoaderBase for details).
			// returns: dojo/promise/Promise
			//		The promise returned has an extra property not found on on standard
			//		promises: response. The response property is a standard promise that
			//		is resolved with an object representing the response from the server.
			// example:
			//	|	store.load({data: myObjects, overwrite: true});
			// tag:
			//		public

			var directives = {
				data: this.data,
				handleAs: this.handleAs,
				overwrite: !!this.overwrite
			};
			var suppress = this.suppressEvents;
			var store    = this;
			var promise;

			options = mixin(directives, options);
			this.suppressEvents = true;

			// If the initial load request failed, reset _storeReady to allow for
			// another attempt.
			if (this._storeReady.isRejected()) {
				this._storeReady = new Deferred();
				this.waiting     = this._storeReady.promise;
			}

			promise = this.loader.load(options);
			promise.always(function () {
				store.suppressEvents = suppress;
				store.data = null;
			});
			promise.then(
				function () {
					setTimeout(function () {
						store._emit("load");
						store._storeReady.resolve(store);
					}, 0);
					store.waiting = false;
				},
				store._storeReady.reject
			);
			return promise;
		},

		setData: function (data) {
			// summary:
			//		Clear the store and load the data. This method is provided for
			//		dojo/store/Memory compatibility only (See also load())
			// data: Object[]?
			//		An array of objects.
			// tag:
			//		Public
			this.data = data;
			this.clear();
			this.load();
		}

	});	/* end declare() */
	return _Loader;
});
