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
		"../_base/Directives",
		"../_base/library",
		"../error/createError!../error/StoreErrors.json",
		"../util/QueryEngine",
		"./_LoadDeferred",
		"./_LoaderBase",
		"./_LoadRequest"
	], function (request, handlers, Directives, lib, createError, QueryEngine, LoadDeferred,
	             LoaderBase, LoadRequest) {
	"use strict";

	// module
	//		indexedStore/loader/Advanced
	// summary:
	//		This module implements the Advanced loader. The loader offers a rich
	//		feature set including:
	//
	//			1 - Loading in-memory data, from URL's or local storage (WebStorage)
	//			2 - Support for Custom Data Handlers
	//			3 - Pre-load object filtering
	//			4 - Enhanced error handling (set error limits).
	//
	// interface:
	//		[Constructor(Store store, LoadDirectives kwArgs)]
	//		interface LoaderAdvanced : LoaderBase {
	//			Deferred	_xhr(DOMString url, optional LoadDirectives options);
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
	//	|	         "store/_base/_Loader!Advanced",
	//	|	                   ...
	//	|	        ], function (declare, _Store, _Indexed, _Loader, ... ) {
	//	|
	//	|	    var StoreClass = declare([_Store, _Indexed, _Loader]);
	//	|	    var myStore = new StoreClass({url: "Simpsons.json", keyPath: "name"});
	//	|	                   ...
	//	|	});

	var C_MSG_NO_WEBSTORAGE = "no webStorage support detected";

	var StoreError = createError("Loader");		// Create the StoreError type.
	var isObject   = lib.isObject;
	var mixin      = lib.mixin;

	//	Define the additional load directives supported by this loader. The directives
	//	are split into 'public' and 'protected' directives. All public directives are
	//	exposed as writable properties of the loader, whereas protected directives are
	//	not enumerated and can only be set by passing them as directives to the load()
	//	method.

	var publicDirectives = {

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

		// keyPrefix: String|RegExp
		keyPrefix: "",

		// maxErrors: Number
		//		The maximum number of data errors allowed before a load request is
		//		aborted. The default is zero.
		maxErrors: 0,

		// preventCache: Boolean
		//		If false it allows the browser and any proxy server to cache
		//		the server response. (applicable to URL's only).
		preventCache: false,

		// separator: String
		separator: ",",

		// timeout: Number
		//		If a URL is specified the time allowed for the underlying XHR request
		//		to complete before it is aborted.  The timeout property is specified
		//		in milliseconds.
		timeout: 0
	};

	var protectedDirectives = {
		// data: any
		//		Data object. If handleAs is not specified data must be an array
		//		of objects. However, the store put no constraints on the type of
		//		objects. (See also the 'handleAs' property).
		data: null,

		// dataHandler: Function|Object
		//		The data handler for the data/response. If dataHandler is an key:value
		//		pairs object, the object should looks like:
		//
		//			{ handler: Function|Object,
		//				options: Object?
		//				name: String?
		//			}
		//
		//		If the handler property is an object the object MUST have a property
		//		named 'handler' whose value is a function.	In this case the handler
		//		object provides	the scope/closure for the handler function and the
		//		options, if any, are mixed into the scope. For example:
		//
		//		  dataHandler: { handler: csvHandler,
		//			             options: { fieldNames:["col1", "col2"] },
		//		                 name: "csv"
		//									 }
		//		The handler function has the following signature:
		//
		//			handler( response )
		//
		//		The response argument is a JavaScript key:value pairs object with
		//		at least a "text" property.
		//
		//		(See indexedstore/handler/csvHandler.js for an example handler).
		dataHandler: null,

		// url: String
		//		The Universal Resource Location (URL) to retrieve the data from. If
		//		the webStorage directive is also specified, the webStorage directive
		//		takes precedence.
		url: null,

		// webStorage: Boolean
		//		If true an attempt is made to load data from the window.localStorage
		//		object (e.g Web Storage).  If the data directive is also specified,
		//		the data directive takes precedence.
		webStorage: false
	};

	var LoadDirectives = mixin(null, publicDirectives, protectedDirectives);

	function getWebStorage(request) {
		// summary:
		//		Load data from the window.localStorage object.
		// description:
		//		Load data from the window.localStorage object. The Web Storage specs
		//		state that both the key and value are DOMStrings but does not define
		//		any encoding, therefore no decoding is performed.
		//		However, this method assumes all data is JSON encode unless specified
		//		otherwise (see directives: handleAs and separator).
		// request: LoadRequest
		//		Instance of LoadRequest
		// options: LoadDirectives
		// returns: String
		//		A comma separated string enclosed in square brackets.
		// tag:
		//		private
		var i, key, regexp, value;
		var options   = request.directives;
		var separator = options.separator;
		var prefix    = options.keyPrefix;
		var storage   = window.localStorage;
		var data      = [];
		var result    = "";

		if (storage) {
			regexp = (prefix instanceof RegExp) ? prefix : new RegExp("^" + prefix || "");
			for (i = 0; i < storage.length; i++) {
				key = storage.key(i);
				if (regexp.test(key)) {
					value = storage.getItem(key);
					data.push(value);
				}
			}
			if ((!options.handleAs || options.handleAs == "json") && separator == ",") {
				result = "[" + data.join(separator) + "]";
				options.handleAs = "json";
			} else {
				result = data.join(separator);
			}
		} else {
			throw new StoreError("Dependency", "constructor", C_MSG_NO_WEBSTORAGE);
		}
		return result;
	}

	function LoaderAdvanced(store, kwArgs) {
		// summary:
		//		Advanced loader constructor
		// store: Store
		// kwArgs: Object
		//		A JavaScript key:value pairs object. This is the same object passed
		//		to the store constructor.
		// tag:
		//		public

		LoaderBase.call(this, store, "advanced", kwArgs);

		//====================================================================
		// protected methods

		this._getData = function (request) {
			// summary:
			//		Fetch the data from the URL or, if in-memory data or a web
			//		store is specified handle the data as if it was received from
			//		a server. This way a unified result is returned.
			// request: LoadRequest
			// returns: Promise
			//		A dojo/request style promise. The promise has an additional
			//		property not found on standard promises: response.
			// tag:
			//		private
			var deferred, result, response;
			var options  = request.directives;
			var data     = options.data;

			switch (request.origin) {
				case LoadRequest.WEBSTORE:
					data = getWebStorage(request);
					/* NO BREAK HERE */
				case LoadRequest.MEMORY:
					// Mimic a dojo/request result.
					response = {text: data, status: 200, options: {handleAs: options.handleAs}};
					deferred = new LoadDeferred();
					try {
						response = handlers(response);
						deferred.resolve(response);
					} catch (err) {
						deferred.response = mixin(response, {status: 12});
						deferred.reject(err);
					}
					result = deferred.promise;
					break;
				case LoadRequest.URL:
					options.headers = this._mergeHeaders(this.headers, options.headers);
					result = this._xhrRequest(options.url, options);
					break;
			}
			return result;
		};

		this._storeData = function (request, response) {
			// summary:
			//		Load an array of data objects into the store. This method is called
			//		after the raw data has been processed by the data handler in case
			//		the optional 'handleAs' property was set.
			// request: LoadRequest
			// response: Object
			// options: LoadDirectives
			//		A JavaScript key:value pairs object. The object properties define
			//		additional directives for the load process.
			// tag:
			//		private
			var i, key, max, errors = 0;
			var options = request.directives;
			var store   = request.store;
			var flags   = options.overwrite ? {overwrite: true} : null;
			var filter  = options.filter;
			var data    = response.data || [];
			var stored  = [];
			var value;

			max  = data.length;

			if (this.url) {
				// If the data was loaded from a URL there is  no need to clone
				// the object
				flags = mixin(flags, {clone: false});
			}
			if (data instanceof Array) {
				store._trigger("preload", data, options);
				if (filter) {
					// Pre-filter the objects.
					if (isObject(filter)) {
						data = QueryEngine(filter)(data);
					} else if (typeof filter == "function") {
						data = data.filter(filter);
					}
				}
				for (i = 0; i < max && !request.canceled; i++) {
					try {
						value = data[i];
						key = store._storeRecord(value, flags);
						stored.push(value);
					} catch (err) {
						if (options.maxErrors > 0) {
							if (errors++ < options.maxErrors) {
								// Don't keep pounding the console, display the first 10 errors....
								if (errors < 10) {
									console.warn("Failed to add object #" + i + ", key: [" + key + "], reason :" + err.name);
								}
							} else {
								console.warn("At least ", errors, " objects failed.");
								store._trigger("postload", stored, options, errors);
								throw new StoreError("DataError", "_loadData", "error limit exceeded");
							}
						} else {
							store._trigger("postload", stored, options, errors);
							throw err;
						}
					}
				}
				store._trigger("postload", stored, options, errors);
				if (errors >= 10) {
					console.warn(errors - 10, " more objects failed.");
				}
			} else {
				throw new StoreError("DataError", "_loadData", "store data must be an array of objects");
			}
			return true;
		};

		this._xhrRequest = function (url, options) {
			// summary:
			//		Initiate a XMLHttpRequest. This method may be overridden by
			//		the CORS extension (indexedStore/extension/CORS).
			// url: String
			//		Universal Resource Location
			// options: LoadDirectives
			// tag:
			//		protected
			return request(url, {
				method: "GET",
				handleAs: options.handleAs || "json",
				headers: options.headers,
				timeout: options.timeout,
				preventCache: options.preventCache
			});
		};

		// Declare directives and set their default values
		this._directives.declare(protectedDirectives, null, Directives.PROTECTED);
		this._directives.declare(publicDirectives, kwArgs);

		// Indicate this loader has a 'xhr' method that can be overwritten, this
		// information is used by the CORS extension.
		this.features.add("data, url, webstorage", true);
		this.features.add("xhr", "_xhrRequest");

		lib.protect(this);

	} /* end Advanced() */

	LoaderAdvanced.prototype = new LoaderBase();
	LoaderAdvanced.prototype.constructor = LoaderAdvanced;

	return LoaderAdvanced;
});
