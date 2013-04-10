//
// Copyright (c) 2012-2013, Peter Jekel
// All rights reserved.
//
//	The Checkbox Tree (cbtree) is released under to following three licenses:
//
//	1 - BSD 2-Clause								(http://thejekels.com/cbtree/LICENSE)
//	2 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	3 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/declare",
				"dojo/_base/lang",
				"dojo/Deferred",
				"dojo/request",
				"dojo/request/handlers",
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, lang, Deferred, request, handlers, createError ) {
	"use strict";
	
	// module:
	//		store/extension/CORS
	// summary:
	//		

	var StoreError = createError( "CORS" );		// Create the StoreError type.

	var CORS = {
		// summary:
		//		Add support for Cross-Origin Resource Sharing (CORS).
		//
		
		//=========================================================================
		// constructor
		
		constructor: function () {
			if (!this.features.has("loader")) {
				throw new StoreError( "MethodMissing", "constructor", "the 'loader' extension must be loaded first" );
			}
			this.features.add("CORS");
		},

		//=========================================================================
		// Private methods.
		
		_xhrGet: function (url, handleAs, options) {
			var timeout = (options && options.timeout) || 0;
			var headers = null;

			// URL must start with either 'http://' or 'https://'
			if (/^https?\:\/\//i.test(url)) {
				if (typeof XDomainRequest !== "undefined") {
					var xdr = new XDomainRequest()
					var dfd = new Deferred(xdr.abort);
					if (xdr) {
						// IE9 issue: request may be aborted by the browser for no obvious reason.
						// Workaround: Declare ALL event handlers.
						xdr.onprogress = function () {};
						xdr.onload  = function () {
							var response = {text: xdr.responseText, options:{handleAs: handleAs}};
							var data = handlers( response ).data;
							dfd.resolve( data );	
						};
						xdr.onerror = function () {
							dfd.reject( new StoreError( "RequestError", "_xhrGet", "Failed to load: "+url ) );
						};
						xdr.ontimeout = function() {
							dfd.reject( new StoreError( "RequestError", "_xhrGet", "Timeout loading: "+url ) );
						}
						if (timeout > 0) {
							xdr.timeout = timeout;
						}
						xdr.open("get", url);
						xdr.send();

						return dfd.promise;
					}
				} else {
					// Force dojo not to add the 'X-Requested-With' header.
					headers = {"X-Requested-With": null};
				}
			}
			return request(this.url, {method:"GET", handleAs: handleAs, headers:headers, 
																 timeout: timeout, preventCache: true});
		}

	};

	return declare( null, CORS );

});
