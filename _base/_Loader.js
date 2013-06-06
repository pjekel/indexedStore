//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/declare",
				"dojo/Deferred",
				"./Library",
				"./LoaderPlus",
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, Deferred, Lib, Loader, createError) {
	
	// module:
	//		indexedStore/_base/_Loader
	// summary:
	//		Replaces the default store loader (LoaderBase) with the enhanced store
	//		loader (LoaderPlus) and overwrite the store's load() method. 
	// 		The enhanced loader adds the ability to load data using URLs, filter
	//		data and register custom data handlers. For detailed information on the
	//		enhanced loader please refer to the LoaderPlus.js module.
	
	var StoreError = createError("Loader");		// Create the StoreError type.
	var isObject   = Lib.isObject;
	var mixin      = Lib.mixin;
	
	var _Loader = declare(null, {

		//=========================================================================
		// Constructor keyword arguments (LoadDirectives):

		// data: Array
		//		An array of objects to be loaded in the store.
		data: null, 

		// dataHandler: Function|Object
		//		The data handler for the data/response. If dataHandler is an key:value
		//		pairs object, the object should looks like:
		//
		//			{ handler: Function|Object,
		//				options: Object?
		//				type: String?
		//			}
		//
		//		If the handler property is an object the object MUST have a property
		//		named 'handler' whose value is a function.	In this case the handler
		//		object provides	the scope/closure for	the handler function and the
		//		options, if any, are mixed into the scope. For example:
		//
		//		  dataHandler: { handler: csvHandler,
		//			               options: { fieldNames:["col1", "col2"] },
		//		                 type: "csv"
		//									 }
		//		The handler function has the following signature:
		//
		//			handler( response )
		//
		//		The response argument is a JavaScript key:value pairs object with a
		//		"text" or "data" property.
		//
		//		(See Indexedstore/handler/csvHandler.js for an example handler).
		dataHandler: null,

		// filter: Object | Function
		//		A query object or function applied to the store data prior to loading
		//		the store. The filter property is used to load a subset of objects
		//		in the store. If filter is a function it is called once for every raw
		//		data object, the function must return either boolean true or false.
		filter: null,
		
		// handleAs: String
		//		If the handleAs property is omitted and the data property is specified
		//		no action is taken on the data. Whenever the url property is specified
		//		the handleAs property defaults to "json".
		handleAs: null,

		// maxErrors: Number
		//		The maximum number of data errors allowed before a load request is
		//		aborted.
		maxErrors: 0,
		
		// overwrite: Boolean
		//		If true, overwrite store objects if objects with the same key already
		//		exist, otherwise an exception of type ConstraintError is thrown.
		//		This overwrite property only applies when loading data.
		//		(See also maxErrors)
	  overwrite: false,

		// progress: Boolean
		//		If true, the loader reports progress.
		progress: false,
		
		// timeout: Number
		timeout: 0,
		
		// url: String
		//		The Universal Resource Location (URL) to retrieve the data from. If
		//		both	the data and url properties	are specified the	data property
		//		takes precendence. (See also 'handleAs')
		url: null,

		//=========================================================================
		// Constructor

		constructor: function (kwArgs) {
			// summary:
			//		Replace the default store loader with an instance of LoaderPlus.
			// kwArgs: Object?
			//		A JavaScript key:value pairs object
			//			{
			//				dataHandler: Object|Function?
			//				filter: (Object|Function)?,
			//				handleAs: String?,
			//				maxErrors: Number?,
			//				progress: Boolean?
			//				timeout: number?,
			//				url: String?
			//			}

			if (this.features.has("hierarchy, CORS")) {
				throw new StoreError("Dependency", "constructor", "loader must be installed prior to any extension");
			}

			if (this.data && this.url) {
				throw new StoreError("DataError", "constructor","DATA and URL property are mutal exclusive");
			}
			this.loader = new Loader(this);
			this.features.add("loader");
		},

		postscript: function (kwArgs) {
			// summary:
			//		Called after all chained constructors have been executed.
			// kwArgs: Object?
			//		See constructor
			// tag:
			//		Private

			this.inherited(arguments);
			// Register the data handler if any.
			if (this.dataHandler) {
				var handler = this.dataHandler;
				var type, options;

				if (isObject(this.dataHandler)) {
					handler = this.dataHandler.handler; 
					options = this.dataHandler.options;
					type    = this.dataHandler.type;
				}
				this.loader.register( (type || this.handleAs), handler, options);
			}
			if (this.autoLoad) {
				this.load();
			}
		},

		//=========================================================================
		// Public IndexedStore/api/store API methods

		load: function (options) {
			// summary:
			//		Initiate a new load request.
			// options: Store.LoadDirectives?
			// returns: dojo/promise/Promise
			//		dojo/promise/Promise
			// tag:
			//		Public

			// If the initial load request failed reset _storeReady to allow for
			// another attempt.
			if (this._storeReady.isRejected()) {
				this._storeReady = new Deferred();
				this.waiting     = this._storeReady.promise;
			}

			var directives = { 
				data: this.data, 
				url: this.url, 
				filter: this.filter, 
				handleAs: this.handleAs,
				timeout: Number(this.timeout) || 0,
				maxErrors: Number(this.maxErrors) || 0,
				progress: this.progress || false,
				overwrite: !!this.overwrite
			};
			var options  = mixin( directives, options );
			var suppress = this.suppressEvents;
			var store    = this;
			var promise;
			
			this.suppressEvents = true;
			promise = this.loader.load( options );
			promise.always( function () {
				store.suppressEvents = suppress;
				store.data = null;
				store.url = null;
			});
			promise.then( 
				function () {
					setTimeout( function () {
						store._emit( "load" );
						store._storeReady.resolve(store);
					}, 0);
					store.waiting = false;
				},
				store._storeReady.reject
			);
			return promise;
		}

	});	/* end declare() */

	return _Loader;

});
