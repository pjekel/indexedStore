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
				"dojo/_base/lang",
				"dojo/Deferred",
				"dojo/request",
				"dojo/Stateful",
				"dojo/request/handlers",
				"dojo/store/util/QueryResults",
				"../_base/Keys",
				"../_base/Library",
				"../dom/event/Event",
				"../error/createError!../error/StoreErrors.json",
				"../util/QueryEngine"
			 ], function (declare, lang, Deferred, request, Stateful, handlers,
										 QueryResults, Keys, Lib, Event, createError, QueryEngine) {
	
	// module:
	//		store/_base/_Loader
	// summary:

	var StoreError = createError("Loader");		// Create the StoreError type.
	var debug = dojo.config.isDebug || false;
	var undef;
	
	function fixError( error ) {
		// summary:
		//		Work-around for a dojo 1.8/1.9 XHR bug. Whenever a XHR requests fails
		//		the server response is still processed by the 'handleAs' data handler
		//		resulting in an incorrect error name (SyntaxError) and message.
		// Note:
		//		Bug filed as: http://bugs.dojotoolkit.org/ticket/16223
		// tag:
		//		Private
		if (error.response) {
			switch (error.response.status) {
				case 404:
					error.message = error.response.url.match(/[^?#]*/)[0];
					error.name    = "NotFoundError";
			}
		}
		return error;
	}

	var Loader = declare([Stateful], {
		// summary:

		//=========================================================================
		// Constructor keyword arguments:

		// autoLoad: Boolean
		//		Indicates, when a URL is specified, if the data should be loaded during
		//		store construction or deferred until the user explicitly calls the load
		//		method.
		autoLoad: true,

		// data: Array
		//		The array of all raw objects to be loaded in the memory store. This
		//		property is only used during store construction.
		//		(See also the 'dataHandler' and 'handleAs' properties).
		data: null,

		// dataHandler: Function|Object
		//		The data handler for the data/response. If dataHandler is an key:value
		//		pairs object, the object should looks like:
		//
		//			{ handler: Function|Object,
		//				options: Object?
		//			}
		//
		//		If the handler property is an object the object MUST have a property
		//		named 'handler' whose value is a function.	In this case the handler
		//		object provides	the scope/closure for	the handler function and the
		//		options, if any, are mixed into the scope. For example:
		//
		//			dataHandler: { handler: csvHandler,
		//										 options: { fieldNames:["col1", "col2"] }
		//									 }
		//		The handler function has the following signature:
		//
		//			handler( response )
		//
		//		The response argument is a JavaScript key:value pairs object with a
		//		"text" or "data" property.
		//
		//		(See cbtree/stores/handlers/csvHandler.js for an example handler).
		dataHandler: null,

		// filter: Object | Function
		//		Filter object or function applied to the store data prior to loading
		//		the store. The filter property is used to load a subset of objects
		//		in the store.
		filter: null,
		
		// handleAs: String
		//		If the handleAs property is omitted and the data property is specified
		//		no action is taken on the data. Whenever the url property is specified
		//		the handleAs property defaults to "json".
		handleAs: null,

		// maxErrors: Number
		//		The maximum number of data errors that may occur before a load request
		//		is aborted.
		maxErrors: 50,
		
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

		constructor: function (/*Object*/ kwArgs) {
			// summary:
			//		Creates a generic memory object store capable of loading data from
			//		either an in memory data object or URL.	 If both the data and url
			//		properties are specified the data object takes precedence.
			// kwArgs:
			//		A JavaScript key:value pairs object
			//			{
			//				autoLoad: Boolean?,
			//				data: Object[]?,
			//				dataHandler: Object|Function?
			//				handleAs: String?,
			//				progress: Boolean?
			//				url: String?
			//			}

			if (this.features.has("hierarchy, CORS")) {
				throw new StoreError("AccessError", "constructor", "loader module must be installed prior to any extension");
			}
			this._loadDeferred = null;
			this._loadPending  = false;

			this.features.add("loader");
			this._loadReset();

			Lib.protect(this);
		},

		postscript: function (/*Object*/ kwArgs) {
			// summary:
			//		Called after all chained constructors have been executed.
			// kwArgs:
			// tag:
			//		Private
			this.inherited(arguments);

			if (this.dataHandler) {
				var scope   = this.dataHandler.handler || this.dataHandler;
				var options = this.dataHandler.options;
				var type    = this.dataHandler.type || this.handleAs;
				var setter, handler;

				if (type) {
					switch (typeof scope) {
						case "function":
							scope = new scope();
							if (typeof scope.handler != "function") {
								handler = this.dataHandler;
								scope   = undefined;
								break;
							}
							/* NO BREAK HERE */
						case "object":
							handler = scope.handler;
							setter  = scope.set;
							break;
						default:
							throw new StoreError( "InvalidType", "postscript", "handler must be a function");
					}
					if (handler) {
						// Register the new or override an existing data handler.
						handlers.register( type, (scope ? lang.hitch(scope, handler) : handler));
						if (scope && options) {
							setter ? setter.call(scope, options) : lang.mixin(scope, options);
						}
					}
				} else {
					throw new StoreError( "InvalidType", "postscript", "handler type required");
				}
			}

			// If no data or URL is specified and autoLoad is enabled it is assumed
			// the caller wants to create an empty store.
			if (!this.data && !this.url && this.autoLoad) {
				this.set("data",[]);
			}
			if (this.autoLoad) {
				// NOTE: this is the only instance where _storeReady can be rejected.
				// It's the only way to let the caller known the initial load request
				// failed.
				this.load({timeout: this.timeout}).then( null, this._storeReady.reject );
			}
		},

		//=========================================================================
		// Getters & Setters (see Stateful.js)

		_autoLoadSetter: function (autoLoad) {
			// summary:
			// tag:
			//		Private
			this.autoLoad = !!autoLoad;
		},
		
		_dataSetter: function (data) {
			// summary:
			//		Set the store's 'data' property. The data and url properties are
			//		mutal exclusive.  No type validation is performed as the caller
			//		may use a custom data handler.
			// data:
			//		In memory data object to be loaded.
			// tag:
			//		Private
			if (this.url) {
				throw new StoreError("InvalidProperty", "_dataSetter","DATA and URL property are mutal exclusive");
			}
			this.data = data;
		},
		
		_timeoutSetter: function (value) {
			if (typeof value == "number" && value > 0) {
				this.timeout = value;
			} else {
				this.timeout = 0;
			}
		},
		
		_urlSetter: function ( url ) {
			// summary:
			// url:
			//		The Universal Resouce Location of the data to be loaded.
			// tag:
			//		Private
			if (this.data) {
				throw new StoreError("InvalidProperty", "_urlSetter","DATA and URL property are mutal exclusive");
			}
			if (typeof url != "string") {
				throw new StoreError("InvalidType", "_urlSetter","URL property must be of type string");
			}
			this.url = url;
		},

		//=========================================================================
		// Private methods

		_storeIsReady: function () {
			// summary:
			//		Override the method in BaseStore. If this module (Loader) is installed
			//		the store isn't considered ready until a data load completed sucessful.
			//		(See _loadSuccess)

			// Don't resolve _storeReady here....
		},

		_loadError: function (err, defer) {
			// summary:
			//		a XHR request failed or the data loaded is invalid, reset the current
			//		load state and reject the load request.
			// err:
			//		Error condition.
			// defer:
			//		The deferred associated with the user load request. This is NOT the
			//		promise returned by the XHR request!
			// returns:
			//		dojo/promise/Promise
			// tag:
			//		Private

			var error = new StoreError( fixError(err), "load");
			this._loadReset(error);
			defer.reject( error );
			this.error = error;
			return defer.promise;
		},

		_loadData: function (/*Object[]?*/ data, /*dojo/Deferred*/ defer) {
			// summary:
			//		Load an array of data objects into the store and indexes it.	This
			//		method is called after the raw data has been processed by the data
			//		handler in case the 'handleAs' property is set.
			// data:
			//		An array of objects.
			// returns:
			//		void
			// tag:
			//		Private

			var data  = data || [];
			var max   = data.length;
			var clone = this._clone;
			var store = this;
			var key, i, errors = 0;

			if (debug) {Lib.debug( "Start loading store" );	}
			
			if (data instanceof Array) {
				if (store.filter) {
					data = QueryEngine(store.filter)(data);
				}
				try {
					store.dispatchEvent( new Event ("loadStart", {detail:{store:this}}) );
					// If loading from a remote source skip cloning...
					if (defer.url) {
						store._clone = false;
					}
					for (i = 0; i < max; i++) {
						try {
							store._storeRecord( data[i] );
							// Report progress every 500 records.
							if (store.progress && !(i % 500)) {
								store._loadProgress(max, i, defer);
							}
						} catch(err) {
							if (store.maxErrors > 0 && errors++ < store.maxErrors) {
								// Don't keep pounding the console, display the first 25 errors....
								if (errors < 25) {
									key = Keys.getKey( store, data[i] );
									console.warn("Failed to add object #"+i+", key: ["+key+"]: "+err.name);
								}
							} else {
								throw new StoreError("DataError", "_loadData", "error limit exceeded");
							}
						}
					}
					if (errors >= 25) {
						console.warn( errors - 25, " more objects failed.");
					}
					store.dispatchEvent( new Event ("loadEnd", {detail:{store:this}}) );
					store._loadProgress(100, 100, defer);
					store._loadSuccess(defer);
				} catch (err) {
					store.dispatchEvent( new Event ("loadFailed", {detail:{store:this}}) );
					throw err;
				} finally {
					store._clone = clone;
				}
			} else {
				throw new StoreError("DataError", "_loadData", "store data must be an array of objects");
			}
		},

		_loadProgress: function (/*Number*/ total, /*Number*/ loaded, /*dojo.Deferred*/ defer) {
			// summary:
			//		Report progress to both the current load request and the store. The
			//		progress is reported as a percentage of loaded units. Units in this
			//		context can be anything. (bytes, records, ...)
			// total:
			//		Total units to be loaded.
			// loaded:
			//		Units currently loaded.
			// defer:
			//		dojo/Deferred associated with the current load request.
			// tag:
			//		Private

			if (this.progress) {
				var done = total > 0 ? (((loaded / total) * 100) >>> 0) : 0;
				this._storeReady.progress(done);
				if (defer) {
					defer.progress(done);
				}
			}
		},

		_loadReset: function (reason) {
			// summary:
			//		Called when a load request was canceled or failed.
			// tag:
			//		Private

			//If the initial store load failed (postscript) reset _storeReady.
			if (this._storeReady.isRejected()) {
				this._storeReady = new Deferred();
			}
			if (this._handle) {
				clearTimeout( this._handle );
				this._handle = 0;
			}
			this._loadDeferred = new Deferred(lang.hitch( this, "_loadReset") );
			this._loadPending  = false;
			this.handleAs      = null;
			this.data          = null;
			this.url           = null;
		},

		_loadSuccess: function (/*dojo/Deferred*/ defer) {
			// summary:
			//		Called when a load request has successfully completed. Once a load
			//		is successful the store enters the ready state.
			// defer:
			//		Deferred associated with the load request.
			// tag:
			//		Private

			if (debug) {Lib.debug("End loading store, "+this._records.length+" records" );	}
			delete this.error;
			this._loadReset(null);
			this._storeReady.resolve(this);
			if (defer.handle) {
				clearTimerout(defer.handle);
			}
			defer.resolve(this);
		},

		_xhrGet: function (url, handleAs, options) {
			var timeout = (options && options.timeout) || 0;
			if (debug) {Lib.debug( "Start XHR request" );	}
			return request(this.url, {method:"GET", handleAs: handleAs, timeout: timeout, preventCache: true});
		},

		//=========================================================================
		// Public cbtree/store/api/store API methods

		close: function (/*Boolean?*/ clear) {
			// summary:
			//		Closes the store and optionally clear it. Note: this method has no
			//		effect if the store isn't cleared.
			// clear:
			//		If true, the store is reset. If not specified the store property
			//		'clearOnClose' is used instead.
			// tag:
			//		Public

			var reason = new StoreError( "RequestCancel", "close", "load request was canceled");
			var callback = lang.hitch( this, "_loadReset");
			// This will guarentee that _loadReset() is called one way or the other.
			this._loadDeferred.then( callback, callback );
			this._loadDeferred.cancel( reason );

			this.inherited(arguments);
		},

		load: function (/*LoadDirectives?*/ options) {
			// summary:
			//		Implements a simple store loader to load data. If the load request
			//		contains a dataset or URL and a load request is currently pending
			//		the new request is rejected.
			// options:
			//		optional cbtree/store/api/Store.LoadDirectives
			// returns:
			//		dojo/promise/Promise
			// tag:
			//		Public

			var props = ["data", "filter", "handleAs", "timeout", "url"];
			var ldrDef = this._loadDeferred;
			if (!this._loadPending && !ldrDef.isFulfilled()) {
				if (options) {
					if (options.clear) {
						this.clear();
					}
					for (var key in options) {
						if (props.indexOf(key) != -1) {
							this[key] = options[key];
						}
					}
				}

				if (this.data || this.url) {
					var store  = this;
					this._loadPending = true;
					try {
						if (this.data) {
							this.url = null;
							if (this.handleAs)  {
								var response = {text: this.data, options:{handleAs: this.handleAs}};
								this.data = handlers( response ).data;
							}
							this._loadData( this.data, ldrDef );
						} else {
							if (!this.handleAs) {
								this.handleAs = "json";
							}
							ldrDef.url = this.url;
							var result = this._xhrGet( this.url, this.handleAs, {timeout: this.timeout} );
							result.then( 
								function (data){
									try {
										store._loadData( data, ldrDef );
									} catch (err) {
										store._loadError(err, ldrDef);
									}
								}, 
								function (err) {
									// Don't throw exception as it will be caught by dojo/Deferred
									store._loadError(err, ldrDef);
								}, 
								function (progress) {
									store._loadProgress( progress.total, progress.loaded, ldrDef );
								}
							);
						}
					} catch (err) {
						store._loadError(err, ldrDef);
					}
				}
			} else {
				// Store is already loaded or a load request is pending. If this request
				// was to  load new data, reject it.
				if (options) {
					if (options.url || options.data) {
						var def =  new Deferred();
						if (this._loadPending) {
							return def.reject( new StoreError("RequestPending", "load"));
						}
						return def.reject( new StoreError("Access", "load", "store already loaded"));						
					}
				}
			}
			return ldrDef.promise;
		}

	});	/* end declare() */

	return Loader;

});
