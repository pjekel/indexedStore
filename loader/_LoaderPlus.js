//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/request",
		"dojo/request/handlers",
		"../_base/library",
		"../dom/event/Event",
		"../error/createError!../error/StoreErrors.json",
		"../util/QueryEngine",
		"./_LoadDeferred"
	], function (request, handlers, lib, Event, createError, QueryEngine, LoadDeferred) {
	"use strict";

	// module
	//		indexedStore/loader/LoaderPlus
	// summary:
	//		This module implements the enhanced loader. The loader offers a rich
	//		feature set including:
	//
	//			1 - Loading data using URL's
	//			2 - Multiple load requests.
	//			2 - Support for Custom Data Handlers
	//			3 - Pre-load object filtering
	//			4 - Reporting progress
	//			5 - Enhanced error handling (set error limits).
	//			6 - Load request cancellation
	//
	//		If these additional features are not required by your store, simply
	//		use the default loader: indexedStore/loader/Default

	var StoreError = createError("Loader");		// Create the StoreError type.
	var isObject   = lib.isObject;
	var clone      = lib.clone;
	var delegate   = lib.delegate;
	var mixin      = lib.mixin;

	var baseRsp = {options: null, status: 0, text: ""};

	var LoadDirectives = {
		// data: Array
		//		An array of all raw objects to be loaded into the store.
		//		(See also the 'dataHandler' and 'handleAs' properties).
		data: null,

		// filter: Object | Function
		//		A query object or function applied to the data prior to loading
		//		the store. The filter property is used to load a subset of objects
		//		in the store. If filter is a function it is called once for every
		//		raw data object, the function must return either boolean true or
		//		false.
		filter: null,

		// handleAs: String
		//		The content handler to process the data or response payload with.
		//		If omitted and the url property is specified handleAs will default
		//		to "json".
		handleAs: null,

		// headers:
		//		A hash of the custom headers to be sent with the request. Defaults to:
		//		{ "Content-Type":"application/x-www-form-urlencoded" }
		headers: null,

		// maxErrors: Number
		//		The maximum number of data errors allowed before a load request is
		//		aborted. The default is zero.
		maxErrors: 0,

		// overwrite: Boolean
		//		If true, overwrite store objects if objects with the same key already
		//		exist, otherwise an exception of type ConstraintError is thrown.
		//		(See also maxErrors)
		overwrite: false,

		//progress: Boolean
		//		Indicates if progress will be reported during the loading process.
		//		The default is false.
		progress: false,

		// timeout: Number
		//		If a URL is specified the time allowed for the underlying XHR request
		//		to complete before it is aborted.  The timeout property is specified
		//		in milliseconds.
		timeout: 0,

		// url: String
		//		The Universal Resource Location (URL) to retrieve the data from.
		//		If both the data and url properties are specified the data property
		//		takes precedence. (See also 'handleAs')
		url: null
	};

	function fixError(error) {
		// summary:
		//		Work-around for a dojo 1.8/1.9 XHR bug. Whenever a XHR requests fails
		//		the server response is still processed by the 'handleAs' data handler
		//		resulting in an incorrect error name (SyntaxError) and message.
		// Note:
		//		Bug filed as: http://bugs.dojotoolkit.org/ticket/16223
		// error:
		// tag:
		//		Private
		if (error.response) {
			switch (error.response.status) {
				case 404:
					error.message = error.response.url.match(/[^?#]*/)[0];
					error.name    = "NotFoundError";
					break;
			}
		}
		return error;
	}

	function Loader(store) {
		// summary:
		//		The enhanced store loader.
		// store: Store
		//		Instance of a Store object.
		// tag:
		//		public

		var active    = false;
		var loader    = this;
		var queue     = [];

		//========================================================================
		// Private methods

		function loadData(response, defer, options) {
			// summary:
			//		Load an array of data objects into the store. This method is called
			//		after the raw data has been processed by the data handler in case
			//		the optional 'handleAs' property was set.
			// response: Object
			//		The object that fulfilled the dojo/request response promise.
			// defer: dojo/Deferred
			//		The dojo/Deferred associated with the load request.
			// options: LoadDirectives
			//		A JavaScript key:value pairs object. The object properties define
			//		additional directives for the load process.
			// tag:
			//		private
			var cacheable, filter, i, key, max, errors = 0;
			var flags  = options.overwrite ? {overwrite: true} : null;
			var clone  = store._clone;
			var data   = response.data || [];

			max  = data.length;

			if (data instanceof Array) {
				if (filter = options.filter) {
					// Pre-filter the objects.
					if (isObject(options.filter)) {
						data = QueryEngine(filter)(data);
					} else if (typeof filter == "function") {
						data = data.filter(filter);
					}
				}
				try {
					store._trigger("loadStart");
					if (options.url) {
						store._clone = false;
					}
					for (i = 0; i < max && !defer.abort; i++) {
						try {
							key = store._storeRecord(data[i], flags);
							if (options.progress && !(i % 500)) {
								loadProgress(max, i, defer);
							}
						} catch (err) {
							if (options.maxErrors > 0) {
								if (errors++ < options.maxErrors) {
									// Don't keep pounding the console, display the first 10 errors....
									if (errors < 10) {
										console.warn("Failed to add object #" + i + ", key: [" + key + "], reason :" + err.name);
									}
								} else {
									console.warn("At least", errors, "objects failed.");
									throw new StoreError("DataError", "_loadData", "error limit exceeded");
								}
							} else {
								throw err;
							}
						}
					}
					if (errors >= 10) {
						console.warn(errors - 10, " more objects failed.");
					}
					store._clone = clone;
					loadSuccess(defer);
				} finally {
					store._clone = clone;
				}
			} else {
				throw new StoreError("DataError", "_loadData", "store data must be an array of objects");
			}
		}

		function loadError(err, defer) {
			// summary:
			//		a XHR request failed or the data loaded is invalid.
			// err: Error
			//		Error condition, typically an instance of Error
			// defer: dojo/Deferred
			//		The dojo/Deferred associated with the load request.
			// tag:
			//		private
			if (!defer.isFulfilled()) {
				store._trigger("loadFailed");
				store.dispatchEvent(new Event("error", {error: err, bubbles: true, cancelable: true}));
				defer.reject(err);
			}
			defer.error  = err;
			loader.error = err;

			loadNext();
		}

		function loadInit(defer, options) {
			// summary:
			//		Initialize the loader.
			// defer: dojo/Deferred
			//		The dojo/Deferred associated with the load request.
			// options: LoadDirectives
			// tag:
			//		private
			var handleAs = options.handleAs;
			var data     = options.data;
			var url      = options.url;
			var xhrRes, response;
			if (data || url) {
				loader.loading = defer.promise;
				loader.error   = null;
				active = defer;
				try {
					if (data) {
						// When loading in-memory data objects mimic a server response.
						response = {text: data, status: 200, options: {handleAs: handleAs}};
						defer.response = handlers(response);
						loadData(response, defer, options);
					} else {
						xhrRes = loader._xhrGet(url, handleAs, options);
						xhrRes.response.then(
							function (xhrResp) {
								response = defer.response = xhrResp;
								loadData(response, defer, options);
							},
							function (err) {
								err = fixError(err);
								defer.response = err.response;
								loadError(StoreError.call(err, err, "loadInit"), defer);
							}
						);
						defer.then(null, xhrRes.cancel);
					}
				} catch (err) {
					defer.response = mixin(clone(baseRsp), response, {status: 500});
					loadError(StoreError.call(err, err, "loadInit"), defer);
				}
			} else {
				defer.response = mixin(clone(baseRsp), {status: 200});
				loadSuccess(defer);
			}
		}

		function loadNext() {
			// summary:
			//		Initiate the next load request, if any.
			// tag:
			//		private
			var request;

			if (request = queue.shift()) {
				if (!request.defer.isFulfilled()) {
					loadInit(request.defer, request.options);
				} else {
					loadNext();
				}
			} else {
				loader.loading = false;
				active = false;
			}
		}

		function loadProgress(total, loaded, defer) {
			// summary:
			//		Report progress on the active load request. The progress is reported
			//		as a percentage of loaded units.
			// total: Number
			//		Total units to be loaded.
			// loaded: Number
			//		Units currently loaded.
			// defer: dojo/Deferred
			//		The dojo/Deferred associated with the load request.
			// tag:
			//		private
			if (defer && defer.progress) {
				var doneness = total > 0 ? (((loaded / total) * 100) >>> 0) : 0;
				store._storeReady.progress(doneness);
				defer.progress(doneness);
			}
		}

		function loadSuccess(defer) {
			// summary:
			//		Load request completed successfully. The dojo/Deferred associated
			//		with the load request is resolved including the response promise.
			// defer: dojo/Deferred
			//		The dojo/Deferred associated with the load request.
			// tag:
			//		private
			if (!defer.abort) {
				loader.count++;
				store._trigger("loadEnd");
				loadProgress(100, 100, defer);
				defer.resolve(defer.response);
				loadNext();
			}
		}

		this._xhrGet = function (url, handleAs, options) {
			// summary:
			//		Initiate a XMLHttpRequest. This method may be overridden by
			//		the CORS extension (indexedStore/extension/CORS).
			// url: String
			//		Universal Resource Location the request will be made to.
			// handleAs: String?
			//		If specified, the content handler to process the response payload
			//		with. (default is "json")
			// options: Object?
			// tag:
			//		protected
			var headers  = (options && options.headers) || null;
			var timeout  = (options && options.timeout) || 0;

			return request(url, {method: "GET", handleAs: handleAs || "json", headers: headers,
								 timeout: timeout, preventCache: true});
		};

		//========================================================================
		// Public methods

		this.cancel = function (reason) {
			// summary:
			//		Cancel the active and all pending load requests.
			// reason: any?
			//		Reason for cancellation, typically an instance of Error.
			// tag:
			//		public
			var pending = queue.slice();
			var request;

			queue = [];

			if (active) {
				active.error = reason;
				active.cancel(reason);
			}
			while (request = pending.shift()) {
				request.defer.error = reason;
				request.defer.cancel(reason);
			}
		};

		this.load = function (options) {
			// summary:
			//		Submit a load request. If the loader is currently executing	another
			//		request the new request is queued.  All load requests are executed
			//		in the order they are received.
			// options: LoadDirectives?
			//		Optional Loader Directives
			// returns: dojo/promise/Promise
			//		The promise returned has an extra property not found on on standard
			//		promises: response. The response property is a standard promise that
			//		is resolved with an object representing the response from the server.
			// tag:
			//		public
			var ldrDef, rspDef;

			if (options && !isObject(options)) {
				throw new StoreError("DataError", "load", "options argument is not an object");
			}

			options = mixin(clone(LoadDirectives), options);
			ldrDef  = new LoadDeferred(function (reason) {
				if (ldrDef == active) {
					store._trigger("loadCancel");
					ldrDef.error = reason;
					ldrDef.abort = true;
					loadNext();
				}
			} );
			// Create and queue a load request.
			queue.push({defer: ldrDef, options: options});

			if (!loader.loading) {
//				setTimeout( loadNext, 0 );
				loadNext();
			}
			return ldrDef.promise;
		};

		// Public properties
		this.loading = false;
		this.error   = null;
		this.type    = "advanced";
		this.count   = 0;					// Number of successful load requests.

		lib.protect(this);

		// Register callbacks with the store. Whenever a store is closed or cleared
		// the active and all pending load requests, if any, are canceled.

		store._register("close, clear",
			function () {
				var message = "load request was canceled due to a store clear or close operation";
				var reason  = new StoreError("RequestCancel", "cancel", message);
				loader.cancel(reason);
			});
	}	/* end Loader() */
	return Loader;
});
