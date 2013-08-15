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
		"dojo/json",
		"../_base/Directives",
		"../_base/Keys",
		"../_base/library",
		"../error/createError!../error/StoreErrors.json",
		"./_LoaderBase",
		"./_LoadRequest"
	], function (request, JSON, Directives, Keys, lib, createError, LoaderBase, LoadRequest) {
	"use strict";

	// module
	//		indexedStore/loader/Basic
	// summary:

	var StoreError = createError("Loader");		// Create the StoreError type.
	var isObject = lib.isObject;
	var isString = lib.isString;
	var mixinOwn = lib.mixinOwn;
	var mixin    = lib.mixin;

	// Declare the additional load directives supported by this loader.
	var publicDirectives = {
		// handleAs: String
		//		The content handler to process the data or response payload with.
		//		If omitted and the url property is specified handleAs will default
		//		to "json".
		handleAs: null,

		// headers:
		//		A hash of the custom headers to be sent with the request. Defaults to:
		//		{ "Content-Type":"application/x-www-form-urlencoded" }
		headers: null,

		// loadAsync: Boolean
		//		If true, the load request is executed asynchronous, that is,
		//		immediately when the request is received.
		loadAsync: true,

		loadOnly: false,

		// preventCache: Boolean
		//		If false it allows the browser and any proxy server to cache
		//		the server response. (applicable to URL's only).
		preventCache: false,

		// timeout: Number
		//		If a URL is specified the time allowed for the underlying XHR request
		//		to complete before it is aborted.  The timeout property is specified
		//		in milliseconds.
		timeout: 0,

		// baseURL: String
		//		The base URL to use for all requests to the server.  This string
		//		will be pre-pended to the resourceId to compose the URL for the
		//		requests sent to the server
		url: ""
	};

	var protectedDirectives = {
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

		// formData: Object
		formData: null,

		method: "GET",

		// resourceId:
		resourceId: ""
	};

	var getHeaders = {
		"Accept": "application/json, application/javascript; q=0.9"
	};

	var submitHeaders = {
		"Accept": "application/json, application/javascript; q=0.9",
		"Content-Type": "application/json"
	};

	function loaderREST(store, kwArgs) {
		// summary:
		//		REST loader constructor
		// store: Store
		// storeArgs: Object
		// tag:
		//		public

		// Extract the applicable properties from the store arguments and use their
		// values as the defaults for the loader.
		LoaderBase.call(this, store, "rest", kwArgs);

		//====================================================================
		// private methods

		function getParent(path) {
			// summary:
			//		Get the parent of a given path (e.g. the path minus the last segment).
			// tag:
			//		private
			var segm, parent = null;
			if (isString(path)) {
				// Remove the leading and trailing slash if any...
				path = path.replace(/^\s*\/|\/\s*$/g, "");
				if (path && path != "") {
					segm = path.split("/");
					segm.pop();
					parent = segm.join("/");
				}
			}
			return parent;
		}

		//====================================================================
		// protected methods

		this._getData = function (request) {
			// summary:
			//
			// request: LoadRequest
			// returns: Promise
			//		A dojo/request style promise. The promise has an additional
			//		property not found on standard promises: response.
			// tag:
			//		private
			var rscPath, prefix;
			var options = request.directives;
			var rescId  = options.resourceId;

			// When the resourceId is an [object Object] it is safe to assume it is a
			// query object simply because it would otherwise be an invalid key.
			if (isObject(rescId)) {
				prefix  = (/\?/).test(options.url) ? "&" : "?";
				rscPath = prefix + lib.objectToURIQuery(rescId);
			} else {
				rscPath = lib.keyToPath(rescId, true);
			}
			options.headers = this._mergeHeaders(getHeaders, options.headers);
			return this._xhrRequest(options.url + rscPath, options);
		};

		this._putData = this._postData = function (request) {
			// summary:
			// request: LoadRequest
			// tag:
			//		protected
			var options = request.directives;
			var rscId   = options.resourceId;
			var target  = options.url + lib.keyToPath(rscId, true);

			options.headers = this._mergeHeaders(submitHeaders, options.headers);
			return this._xhrRequest(target, options);
		};

		this._storeData = function (request, response) {
			// summary:
			//		Load an array of data objects into the store.
			// request: LoadRequest
			// response: Object
			// options: LoadDirectives
			//		A JavaScript key:value pairs object. The object properties define
			//		additional directives for the load process.
			// tag:
			//		private
			var cacheable, recOpts;
			var options = request.directives;
			var cache  = !!store.cache;
			var data   = response && response.data;
			var key    = options.resourceId;
			var stored = [];
			var value  = null;

			// Make sure the server allows caching of the data, if it doesn't the data
			// will be marked as stale.
			if (cache && response.url && response.getHeader) {
				cacheable = response.getHeader("Cache-Control");
				cache     = !(/no-cache|no-store/i).test(cacheable);
			}
			if (data && !options.loadOnly) {
				switch (options.method) {
					case "GET":
						store._trigger("preload", data, options);
						value = store._retrieveRecord(key).value || {};
						if (store.hierarchical) {
							store.removeChildren(key, true);
							mixin(options, {parent: key});
							if (data instanceof Array) {
								data.forEach(function (child) {
									store._storeRecord(child, options, {stale: true});
									stored.push(child);
								});
							} else if (isObject(data)) {
								value = mixin(value, data);
							} else {
								value = data;
							}
						} else {
							value.response = data;
						}
						recOpts = {key: key, parent: getParent(key), overwrite: true};
						store._storeRecord(value, recOpts, {stale: !cache});
						stored.push(value);
						store._trigger("postload", stored, options, 0);
						break;

					case "POST":
					case "PUT":
						// A service may return either an object or simply a key.
						// If an object is returned it may have a generated key so
						// try to extract the key from the object.
						if (isObject(data)) {
							key = store.getIdentity(data) || key;
						} else if (Keys.validKey(data)) {
							key  = data;
							data = JSON.parse(options.formData);
						}
						recOpts = {key: key, parent: getParent(key), overwrite: true};
						store._storeRecord(data, recOpts, {stale: !cache});
						break;

					case "DELETE":
						data = data instanceof Array ? data : [data];
						data.forEach(function (any) {
							key = isObject(any) ? store.getIdentity(any) : any;
							var parent, record;

							if (Keys.validKey(key)) {
								if (store.hierarchical) {
									store.removeChildren(key, true);
								}
								store._deleteKeyRange(key);
								parent = getParent(key);
								if (parent != null) {
									record = store._retrieveRecord(parent).record;
									if (record) {
										record.tags.stale = true;
									}
								}
							}
						});
						break;
				}
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
				method: options.method || "GET",
				handleAs: options.handleAs || "json",
				headers: options.headers,
				timeout: options.timeout,
				data: options.formData || null,
				preventCache: options.preventCache
			});
		};

		//====================================================================
		// public methods

		this.submit = function (directives) {
			// summary:
			// directives: LOadDirectives
			// tag:
			//		public
			var defer, method, options, request;

			if (directives && !isObject(directives)) {
				throw new StoreError("DataError", "submit", "directives argument is not an object");
			}
			options = this._directives.get(null, directives);
			method  = options.method || "POST";
			request = new LoadRequest(method, options);
			defer   = this.manager.submit(request, options.loadAsync);

			return defer.promise;
		};

		// Declare directives and set their default values
		this._directives.declare(protectedDirectives, null, Directives.PROTECTED);
		this._directives.declare(publicDirectives, kwArgs);

		// Indicate this loader has both a 'xhr' and 'submit' method.
		this.features.add("xhr", "_xhrRequest");
		this.features.add("submit", "submit");
		this.features.add("url", true);
		lib.protect(this);

	} /* end Advanced() */

	// Inherit from the LoaderBase class
	loaderREST.prototype = new LoaderBase();
	loaderREST.prototype.constructor = loaderREST;

	return loaderREST;
});
