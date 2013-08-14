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
		"../loader/_LoadDeferred"
	], function (declare, has, Deferred, request, handlers, lib, createError,
				 LoadDeferred) {
	"use strict";

	// module:
	//		store/extension/CORS
	// summary:
	//		Add Cross-Origin Resource Sharing (CORS) support the to local instance
	//		of the store loader (indexedStore/_base/LoaderPlus).
	// NOTE:
	//		Microsoft Internet Explorer prior to version 10 requires the use of
	//		XDomainRequest() instead of XMLHttpRequest() to support CORS.

	var C_MSG_INVALID_ORDER  = "a XHR capable loader must be installed prior to CORS";
	var C_MSG_INVALID_LOADER = "missing or incompatible loader";

	var StoreError = createError("CORS");		// Create the StoreError type.
	var msXDR = !!(has('ie') && has('ie') < 10 && XDomainRequest !== undefined);
	var delegate = lib.delegate;
	var mixin    = lib.mixin;

	var baseRsp = {options: null, status: 0, text: "", url: ""};

	function xhrRequest(url, options) {
		// summary:
		// url: String
		//		Universal Resource Location
		// options: LoadDirectives
		// tag:
		//		Private
		var data = null, handleAs = "json", headers, method = "GET", noCache = false,
			timeout, url;
		if (options) {
			method   = options.method   || "GET",
			handleAs = options.handleAs || "json";
			headers  = options.headers  || null;
			noCache  = options.preventCache;
			timeout  = options.timeout  || 0;
			data     = options.formData || null;
		}

		// URL must have the 'http' or 'https' schema
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
				// Overwrite the default dojo 'X-Requested-With' header.
				headers = lib.mixin({"X-Requested-With": null}, headers);
			}
		}
		return request(url, {method: method, handleAs: handleAs, headers: headers,
							 timeout: timeout, data: data, preventCache: noCache});
	}

	var CORS = declare(null, {

		//=========================================================================
		// constructor

		constructor: function () {
			if (!this.loader || !this.features.has("loader")) {
				throw new StoreError("Dependency", "constructor", C_MSG_INVALID_ORDER);
			}
			if (this.loader.features) {
				var method = this.loader.features.has("xhr");
				if (!lib.isString(method) || !method.length) {
					if (method !== true) {
						throw new StoreError("TypeError", "constructor", C_MSG_INVALID_LOADER);
					}
					method = "_xhrRequest";
				}
			} else {
				throw new StoreError("TypeError", "constructor", C_MSG_INVALID_LOADER);
			}
			// Extend the local store loader instance.
			this.loader[method] = xhrRequest;
			this.features.add("CORS");
		}
	});
	return CORS;
});
