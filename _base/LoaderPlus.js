define(["dojo/Deferred",
				"dojo/request",
				"dojo/request/handlers",
				"./Library",
				"../dom/event/Event",
				"../error/createError!../error/StoreErrors.json",
				"../util/QueryEngine"
			 ], function (Deferred, request, handlers, Lib, Event, createError, QueryEngine) {

	// module
	//		indexedStore/_base/LoaderPlus
	// summary:
	//		This module implements the enhanced loader. The loader offers a rich
	//		feature set including:
	//
	//			1 - Loading data using URL's
	//			2 - Multiple load requests.
	//			2 - Support for Custom Data Handlers
	//			3 - Pre-load object filtering
	//			4 - Report progress
	//			5 - Enhanced error handling (set error limits).
	//			6 - Load request cancelation
	//
	//		If these additional features are not required by your store, simply
	//		use the default loader: indexedStore/_base/LoaderBase
	
	var StoreError = createError("Loader");		// Create the StoreError type.
	var isObject   = Lib.isObject;
	var clone      = Lib.clone;
	var mixin      = Lib.mixin;
	
	var LoadDirectives = { 
		// data: Array
		//		An array of all raw objects to be loaded into the store.
		//		(See also the 'dataHandler' and 'handleAs' properties).
		data: null, 

		// filter: Object | Function
		//		A query object or function applied to the data prior to loading the
		//		store. The filter property is used to load a subset of objects in
		//		the store. If filter is a function it is called once for every raw
		//		data object, the function must return either boolean true or false.
		filter: null, 

		// handleAs: String
		//		The content handler to process the data or response payload with. If
		//		omitted and the url property is specified handleAs defaults to "json".
	  handleAs: null, 

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
		//		in miliseconds.
	  timeout: 0, 

		// url: String
		//		The Universal Resource Location (URL) to retrieve the data from. If
		//		both	the data and url properties are specified the	data property
		//		takes precendence. (See also 'handleAs')
		url: null
	};

	function fixError (error) {
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

	function Loader (store) {
		// summary:
		//		The enhanced store loader.
		// store: Store
		//		Instance of a Store object.
		// tag:
		//		public

		//========================================================================
		// Private methods

		function loadData (data, defer, options) {
			// summary:
			//		Load an array of data objects into the store. This method is called
			//		after the raw data has been processed by the data handler in case
			//		the optional 'handleAs' property was set.
			// data: Object[]
			//		An array of objects.
			// defer: dojo/Deferred
			//		The dojo/Deferred associated with the load request.
			// options: LoadDirectives
			//		A JavaScript key:value pairs object. The object properties define
			//		additional directives for the load process.
			// tag:
			//		private
			var filter, key, i, errors = 0;
			var flags = options.overwrite ? {overwrite:true} : null;
			var clone = store._clone;
			var data  = data || [];
			var max   = data.length;

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
							key = store._storeRecord( data[i], flags );
							if (options.progress && !(i % 500)) {
								loadProgress(max, i, defer);
							}
						} catch(err) {
							if (options.maxErrors > 0) {
								if (errors++ < options.maxErrors) {
									// Don't keep pounding the console, display the first 10 errors....
									if (errors < 10) {
										console.warn("Failed to add object #"+i+", key: ["+key+"], reason :"+err.name);
									}
								} else {
									console.warn( "At least", errors, "objects failed.");
									throw new StoreError("DataError", "_loadData", "error limit exceeded");
								}
							} else {
								throw err;
							}
						}
					}
					if (errors >= 10) {
						console.warn( errors - 10, " more objects failed.");
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
		
		function loadError (err, defer) {
			// summary:
			//		a XHR request failed or the data loaded is invalid.
			// err: Error
			//		Error condition, typeically an instance of Error
			// defer: dojo/Deferred
			//		The dojo/Deferred associated with the load request.
			// tag:
			//		private
			if (!defer.isFulfilled()) {
				store._trigger("loadFailed");
				store.dispatchEvent( new Event("error", {error:err, bubbles:true, cancelable:true}) );
				defer.reject(err);
			}
			defer.error  = err;
			loader.error = err;

			loadNext();
		}
		
		function loadInit (defer, options) {
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
			var handle;
			
			if (data || url) {
				loader.loading = defer.promise;
				loader.error   = null;
				active = defer;
				try {
					if (data) {
						if (handleAs) {
							var response = {text: data, options:{handleAs: handleAs}};
							data = handlers( response ).data;
						}
						loadData( data, defer, options );
					} else {
						var result = loader._xhrGet( url, handleAs, {timeout: options.timeout} );
						result.then (
							function (data) {
								loadData( data, defer, options );
							},
							function (err) {
								err = fixError(err);
								loadError( StoreError.call( err, err, "loadInit"), defer);
							}
						);
						defer.then( null, result.cancel );
					}
				} catch (err) {
					loadError( StoreError.call(err, err, "loadInit"), defer);
				}
			} else {
				loadSuccess(defer);
			}
		}

		function loadNext () {
			// summary:
			//		Initiate the next load request, if any.
			// tag:
			//		private
			var request;
			
			if ( (request = queue.shift()) ) {
				if (!request.defer.isFulfilled()) {
					loadInit( request.defer, request.options );
				} else {
					loadNext();
				}
			} else {
				loader.loading = false;
				active = null;
			}
		}

		function loadProgress (total, loaded, defer) {
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

		function loadSuccess (defer) {
			// summary:
			//		Load request completed successfully. The dojo/Deferred associated
			//		with the load request is resolved.
			// defer: dojo/Deferred
			//		The dojo/Deferred associated with the load request.
			// tag:
			//		private
			if (!defer.abort) {
				loader.count++;
				store._trigger("loadEnd");
				loadProgress(100, 100, defer);
				defer.resolve(store);
				loadNext();
			}
		}

		this._xhrGet = function (url, handleAs, options) {
			// summary:
			//		Initiate a XMLHttpRequest
			// url: String
			//		Universal Resource Location the request will be made to.
			// handleAs: String?
			//		If specified, the content handler to process the response payload
			//		with. (default is "json")
			// options: Object?
			// tag:
			//		Private
			var timeout  = (options && options.timeout) || 0;
			var handleAs = handleAs || "json";
			
			return request(url, {method:"GET", handleAs: handleAs, timeout: timeout, preventCache: true});
		};

		//========================================================================
		// Public methods

		this.cancel = function (reason) {
			// summary:
			//		Cancel the active and all pending load requests.
			// reason: any?
			//		Reason for cancelation, typically an instance of Error.
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
			//		in the order they are recieved.
			// options: LoadDirectives?
			//		Optional Loader Directives
			// returns: dojo/promise/Promise
			//		dojo/promise/Promise
			// tag:
			//		public

			if (options && !isObject(options)) {
				throw new StoreError( "DataError", "load", "options argument is not an object");
			}
			var options = mixin( clone(LoadDirectives), options );
			var ldrDef  = new Deferred( function (reason) {
				if (ldrDef == active) {
					store._trigger("loadCancel");
					ldrDef.error = reason;
					ldrDef.abort = true;
					loadNext();
				}
			});
			// Create a load request and queue it.
			var request = { defer: ldrDef, options: options }
			queue.push( request );

			if (!loader.loading) {
//				setTimeout( loadNext, 0 );
				loadNext();
			}
			return request.defer.promise;
		};

		this.register = function (type, handler, options) {
			// summary:
			//		Register a data handler.
			// type: String
			//		The symbolic name of the handler. After registration the type can
			//		be used as the value of the loader's 'handleAs' options property.
			// handler: Function|Object
			//		The data handler for the data/response. If handler is an key:value
			//		pairs object, the object must have a 'handler' property whose value
			//		is a function and optionaly have a 'set' property as in:
			//
			//			{ handler: function ( response ) { ... },
			//			  set: function (property, value) { ... }
			//			}
			//
			//		When a load request is successful the data handler is called with a
			//		response argument. The response argument is a JavaScript key:value
			//		pairs object with a 'text' or 'data' property.
			//
			//		(See Indexedstore/handler/csvHandler.js for an example handler).
			// options: any?
			// tag:
			//		Public
			if (type && (isObject(handler) || typeof handler == "function")) {
				var closure = handler;
				var setter;

				switch (typeof closure) {
					case "function":
						closure = new closure();
						if (typeof closure.handler != "function"){
							closure = undefined;
							break;
						}
						/* NO BREAK HERE */
					case "object":
						handler = closure.handler;
						setter  = closure.set;
						break;
				}
				if (handler) {
					handlers.register(type, handler.bind(closure));
					if (closure && options) {
						if (setter) {
							setter.call(closure, options);
						} else {
							mixin(closure, options);
						}
					}
					return closure || handler;
				}
			} else {
				throw new StoreError( "DataError", "register");
			}
		};

		// Public properties
		this.loading = false;
		this.error   = null;
		this.count   = 0;					// Number of successful load requests.

		// Private properties
		var active = null;
		var loader = this;
		var store  = store;
		var queue  = [];

		Lib.protect( this );

		// Register callbacks with the store. Whenever a store is closed or cleared
		// the active and all pending load requests, if any, are canceled.
		
		store._register("close, clear", function () {
				var message = "load request was canceled due to a store clear or close operation"
				var reason  = new StoreError( "RequestCancel", "cancel", message);
				loader.cancel(reason);
			}
		);
	}	/* end Loader() */
	
	return Loader;

});
