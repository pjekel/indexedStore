//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../_base/Directives",
		"../_base/FeatureList",
		"../_base/library",
		"../_base/opcodes",
		"../dom/event/EventTarget",
		"../error/createError!../error/StoreErrors.json",
		"./handler/register",
		"./_LoadManager",
		"./_LoadRequest"
	], function (Directives, FeatureList, lib, opcodes, EventTarget, createError,
	             register, LoadManager, LoadRequest) {
	"use strict";

	// module
	//		indexedStore/loader/_LoaderBase
	// summary:
	//		Base class for all store loaders.
	// interface:
	//		[Constructor(Store store, DOMString type, optional LoadDirectives kwArgs)]
	//		interface LoaderBase : EventTarget {
	//			readonly	attribute	FeatureList		features;
	//			readonly	attribute	LoadManager		manager;
	//			readonly	attribute	boolean			loading;
	//			readonly	attribute	DOMString		type;
	//			readonly	attribute	Error			error;
	//			readonly	attribute	Store			store;
	//
	//			Promise		_getData(LoadRequest request);
	//			object?		_mergeHeaders(sequence<header>);
	//			object		_setDataHandler(LoadDirectives directives);
	//			boolean		_storeData(LoadRequest request, Response response);
	//
	//			void		cancel((Error or DOMString)	reason);
	//			Promise		load(optional LoadDirectives directives);
	//		}
	//
	//		dictionary LoadDirectives {
	//				...
	//		}

	var C_MSG_DIR_NOT_OBJ  = "directives argument is not an object";

	var StoreError = createError("Loader");		// Create the StoreError type.
	var filterOwn  = lib.filterOwn;
	var isObject   = lib.isObject;
	var mixin      = lib.mixin;
	var mixinOwn   = lib.mixinOwn;
	var isEmpty    = lib.isEmpty;

	// Define common public directives.
	var commonDirectives = {
		// loadAsync: Boolean
		//		If true, the load request is executed asynchronous, that is,
		//		immediately when the request is received.
		loadAsync: false,

		// overwrite: Boolean
		//		If true, overwrite store objects if objects with the same key already
		//		exist, otherwise an exception of type ConstraintError is thrown.
		//		(See also maxErrors)
		overwrite: false
	};

	function LoaderBase(store, type, kwArgs) {
		// summary:
		//		The enhanced store loader.
		// store: Store
		//		Instance of a Store object.
		// type: String
		// tag:
		//		public

		if (arguments.length == 0) {
			return;
		}

		EventTarget.call(this, store);

		//========================================================================
		// Protected methods
		this._getData = function (request) {
			// summary:
			//		Fetch the data from the URL or, if the data is specified,
			//		handle the data as if it was received from a server. This
			//		way a unified result is returned.
			// request: LoadRequest
			// returns: Promise
			//		A dojo/request style promise. The promise has an additional
			//		property not found on standard promises: response.
			//		(see indexedStore/loader/_LoaderDeferred).
			// tag:
			//		private
			throw new Error("Abstract function only");
		};

		this._mergeHeaders = function (/* [headers *[,headers]] */) {
			// summary:
			//		Merge HTTP header objects. The HTTP header field names are
			//		normalized as some browsers (like chrome) are case sensitive.
			//		If multiple header objects contain the same field name(s)
			//		the definition in the last object is used.
			// headers: Object?
			//		A JavaScript key:value pairs object. Each key represents a
			//		HTTP header field as in: {"Accept": "application/json"}
			// returns: Object | null
			//		A new object with the merged and normalized HTTP headers.
			// tag:
			//		protected
			var headers = {}, idx = 0, key, source;

			function camelUpper(text) {
				function caps(match) {
					return match.toUpperCase().replace("_", "-");
				}
				return text.toLowerCase().replace(/((^|-|_)[a-z])/g, caps);
			}

			for (idx = 0; idx < arguments.length; idx++) {
				source = arguments[idx];
				for (key in source) {
					var field = camelUpper(key);
					headers[field] = source[key];
				}
			}
			return !isEmpty(headers) ? headers : null;
		};

		this._setDataHandler = function (directives) {
			// summary:
			//		Register any custom data handler.
			// directives: LoadDirectives
			//		A JavaScript key:value pairs object
			// tag:
			//		protected
			if (directives.dataHandler && directives.dataHandler != handler) {
				// Caller specified a custom data handler.
				handler = register(directives.handleAs, directives.dataHandler);
			}
			return handler;
		};

		this._storeData = function (request, response) {
			// summary:
			//		Load an array of data objects into the store. This method is called
			//		after the raw data has been processed by the data handler in case
			//		the optional 'handleAs' property was set.
			// request: LoadRequest
			// response: Object
			// returns: Boolean
			//		True on successful completion otherwise false.
			// tag:
			//		private
			throw new Error("Abstract function only");
		};

		//========================================================================
		// Public methods

		this.cancel = function (reason) {
			// summary:
			//		Cancel all active and pending load requests.
			// reason: any?
			//		Reason for cancellation, typically an instance of Error.
			// tag:
			//		public
			this.manager.cancel(reason);
		};

		this.load = function (directives) {
			// summary:
			//		Submit a load request. If the loader is executing another request
			//		the new request is queued.  All load requests are executed in the
			//		order they are received.
			// directives: LoadDirectives?
			//		Optional Loader Directives
			// returns: dojo/promise/Promise
			//		The promise returned has an extra property not found on standard
			//		promises: response. The response property is a standard promise
			//		that is resolved with an object representing the response from the
			//		server.
			// tag:
			//		public
			var defer, options, request, handler;

			if (directives && !isObject(directives)) {
				throw new StoreError("DataError", "load", C_MSG_DIR_NOT_OBJ);
			}
			// Merge the user specified directives with the default loader directives
			options = this._directives.get(null, directives);
			handler = options.dataHandler && this._setDataHandler(options);
			request = new LoadRequest("GET", options);
			defer   = this.manager.submit(request, options.loadAsync);

			return defer.promise;
		};

		// private properties
		var handler  = null;
		var self     = this;

		// Protected properties
		this._directives = new Directives(this, commonDirectives, kwArgs);

		// Public properties
		this.features   = new FeatureList();
		this.manager    = new LoadManager(this);
		this.loading    = false;			// Boolean or Promise
		this.type       = type;
		this.error      = null;				// Last load error encountered
		this.store      = store;

		// Register with the store for the close and clear triggers.
		if (store) {
			store._register([opcodes.CLOSE, opcodes.CLEAR], function (action) {
				var text   = "load request was canceled due to a store " + action + " operation";
				var reason = new StoreError("RequestCancel", "cancel", text);
				self.cancel(reason);
			});
		}

		// Catch load request and load manager events.
		this.addEventListener("active, error, idle", function (event) {
			var request = event.target;
			switch (event.type) {
				case "active":
					event.stopPropagation();
					this.loading = request.defer.promise;
					this.error   = null;
					break;
				case "error":
					this.error = event.error;
					break;
				case "idle":
					event.stopPropagation();
					this.loading = false;
					break;
			}
		});

	}	/* end Loader() */

	LoaderBase.prototype = new EventTarget();
	LoaderBase.prototype.constructor = LoaderBase;

	return LoaderBase;
});
