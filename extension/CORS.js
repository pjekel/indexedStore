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
				"dojo/has",
				"dojo/Deferred",
				"dojo/request",
				"dojo/request/handlers",
				"../_base/LoaderPlus",
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, has, Deferred, request, handlers, Loader, createError ) {
	"use strict";
	
	// module:
	//		store/extension/CORS
	// summary:
	//		Add Cross-Origin Resource Sharing (CORS) support the to local instance
	//		of the store loader (indexedStore/_base/LoaderPlus).
	// NOTE: 
	//		Adding CORS support to the base loader, indexedStore/_base/LoaderBase,
	//		has no affect.

	var StoreError = createError( "CORS" );		// Create the StoreError type.
	var msXDR = !!(has('ie') && has('ie') < 10 && typeof XDomainRequest !== "undefined");
	
	function xhrGet (url, handleAs, options) {
		// summary:
		// url:
		//		Universal Resource Location the request will be made to.
		// handleAs:
		//		If specified, the content handler to process the response payload
		//		with. (default is "json")
		// options:?
		// tag:
		//		Private
		var prevent  = (options && options.preventCache) || false;
		var timeout  = (options && options.timeout) || 0;
		var handleAs = handleAs || "json";
		var headers  = null;

		// URL must start with either 'http://' or 'https://'
		if (/^https?\:\/\//i.test(url)) {
			if (msXDR) {
				var xdr = new XDomainRequest()
				var dfd = new Deferred(xdr.abort);
				if (xdr) {
					// IE9 issue: request may be aborted by the browser if not ALL event
					// handlers have been defined.
					xdr.onprogress = function () {};
					xdr.onload  = function () {
						var response = {text: xdr.responseText, options:{handleAs: handleAs}};
						var data = handlers( response ).data;
						dfd.resolve( data );	
					};
					xdr.onerror = function (evt) {
						dfd.reject( new StoreError( "RequestError", "_xhrGet", "Failed to load: "+url ) );
					};
					xdr.ontimeout = function() {
						dfd.reject( new StoreError( "RequestError", "_xhrGet", "Timeout loading: "+url ) );
					}
					if (timeout > 0) {
						xdr.timeout = timeout;
					}
					try {
						xdr.open("get", url);
						xdr.send();
					} finally {
						//	If the domain doesn't exist xdr.send() may throw an exception,
						//	so make sure we always return the deferred.
						return dfd.promise;
					}
				}
			} else {
				// Force dojo not to add the 'X-Requested-With' header.
				headers = {"X-Requested-With": null};
			}
		}
		return request(url, {method:"GET", handleAs: handleAs, headers:headers, 
													timeout: timeout, preventCache: true});
	}

	var CORS = {
		//=========================================================================
		// constructor
		
		constructor: function () {
			if (!this.features.has("loader")) {
				throw new StoreError( "Dependency", "constructor", "the '_Loader' class must be loaded first" );
			}
			if (!(this.loader instanceof Loader)) {
				throw new StoreError( "TypeError", "constructor", "store loader must be an instance of Loader" );
			}
			// Extend the local store loader instance.
			this.loader._xhrGet = xhrGet;
			this.features.add("CORS");
		}

	};

	return declare( null, CORS );

});
