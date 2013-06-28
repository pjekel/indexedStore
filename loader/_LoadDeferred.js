//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/Deferred", "../_base/library"], function (Deferred, lib) {
	"use strict";

	// module
	//		indexedStore/loader/LoadDeferred
	// summary:
	//		Create a new deferred. The deferred promise property has an extra
	//		property not found on on standard promises: response.
	//		The response property is a standard promise that is resolved with
	//		an object representing a server-like response.

	function okHandler(response) {
		return Object.freeze(response);
	}

	function dataHandler(response) {
		return response.data || response.text;
	}

	function errHandler(err, response) {
		err.response = response;
		throw err;
	}

	function LoadDeferred(cancel) {
		// summary:
		//		Create a new deferred.
		// description:
		//		Create a new deferred. The deferred promise property has an extra
		//		property not found on on standard promises: response.
		//		The response property is a standard promise that is resolved with
		//		an object representing a server-like response.
		// cancel: Function?
		//		Will be invoked if the deferred is canceled. The canceler receives
		//		the reason the deferred was canceled as its argument.
		//		The deferred is rejected with its return value.
		// returns: indexedStore/loader/LoadDeferred
		//		A new instance of LoadDeferred.
		// tag:
		//		Public
		Deferred.call(this, cancel);

		var respPromise = this.then(okHandler).otherwise(function (err) {
			errHandler(err, self.response);
		});
		var dataPromise = respPromise.then(dataHandler);
		var promise     = lib.delegate(dataPromise, {response: respPromise});
		var self        = this;

		this.response = {data: null, status: 0, text: ""};
		this.promise  = promise;
		this.then     = promise.then;
		this.cancel   = promise.cancel;

		Object.freeze(promise);		// Refreeze the promise.
	}

	// Inherit from dojo/Deferred
	LoadDeferred.prototype = new Deferred();
	LoadDeferred.prototype.constructor = LoadDeferred;

	return LoadDeferred;
});