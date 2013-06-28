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
		"dojo/has",
		"dojo/Deferred",
		"dojo/request",
		"dojo/request/handlers",
		"../_base/library",
		"../error/createError!../error/StoreErrors.json",
		"../loader/_LoadDeferred",
		"../loader/_LoaderPlus"
	], function (declare, has, Deferred, request, handlers, lib,
				createError, LoadDeferred, Loader) {
	"use strict";

	// module:
	//		store/extension/CORS
	// summary:
	//		Add Cross-Origin Resource Sharing (CORS) support the to local instance
	//		of the store loader (indexedStore/_base/LoaderPlus).
	// NOTE:
	//		Adding CORS support to the base loader, indexedStore/_base/LoaderBase,
	//		has no affect.

	var StoreError = createError("CORS");		// Create the StoreError type.
	var msXDR = !!(has('ie') && has('ie') < 10 && XDomainRequest !== undefined);
	var delegate = lib.delegate;
	var mixin    = lib.mixin;

	var baseRsp = {options: null, status: 0, text: "", url: ""};

	function xhrGet(url, handleAs, options) {
		// summary:
		// url:
		//		Universal Resource Location the request will be made to.
		// handleAs:
		//		If specified, the content handler to process the response payload
		//		with. (default is "json")
		// options:?
		// tag:
		//		Private
		var headers  = (options && options.headers) || null;
		var prevent  = (options && options.preventCache) || false;
		var timeout  = (options && options.timeout) || 0;
		handleAs = handleAs || "json";

		// URL must start with either 'http://' or 'https://'
		if (/^https?\:\/\//i.test(url)) {
			if (msXDR) {
				var xdr = new XDomainRequest();
				if (xdr) {
					var xdrDef = new LoadDeferred(xdr.abort);

					// IE9 issue: request may be aborted by the browser if not ALL event
					// handlers have been defined.
					xdr.onprogress = function () {};
					xdr.onload  = function () {
						var response = {
							options: {handleAs: handleAs},
							status: 200,
							text: xdr.responseText,
							url: url
						};
						xdrDef.response = handlers(response);
						xdrDef.resolve(xdrDef.response);
						};
					xdr.onerror = function () {
						var err = new StoreError("RequestError", "_xhrGet", "Failed to load: " + url);
						xdrDef.response = mixin(baseRsp, {url: url});
						xdrDef.reject(err);
					};
					xdr.ontimeout = function () {
						var err = new StoreError("RequestError", "_xhrGet", "Timeout loading: " + url);
						xdrDef.response = mixin(baseRsp, {url: url});
						xdrDef.reject(err);
					};
					if (timeout > 0) {
						xdr.timeout = timeout;
					}
					try {
						xdr.open("get", url);
						xdr.send();
					} finally {
						return xdrDef.promise;
					}
				}
			} else {
				// Force dojo NOT to add the 'X-Requested-With' header.
				headers = lib.mixin({"X-Requested-With": null}, headers);
			}
		}
		return request(url, {method: "GET", handleAs: handleAs, headers: headers,
							 timeout: timeout, preventCache: prevent});
	}

	var CORS = declare(null, {
		//=========================================================================
		// constructor
		constructor: function () {
			if (!this.features.has("loaderAdvanced")) {
				throw new StoreError("Dependency", "constructor", "the 'advanced' loader class must be loaded first");
			}
			if (!(this.loader instanceof Loader)) {
				throw new StoreError("TypeError", "constructor", "store loader must be an instance of Loader");
			}
			// Extend the local store loader instance.
			this.loader._xhrGet = xhrGet;
			this.features.add("CORS");
		}
	});
	return CORS;
});
