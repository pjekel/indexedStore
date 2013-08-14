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
	//		indexedStore/loader/_LoadDeferred
	// summary:
	//		Create a new deferred. The deferred promise property has an extra
	//		property not found on on standard promises: response.
	//		The response property is a standard promise that is resolved with
	//		an object representing a server-like response.

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
		// returns: LoadDeferred
		//		A new instance of LoadDeferred.
		// tag:
		//		Public
		Deferred.call(this, cancel);

		var respPromise = this.then(
			function (response) {
				self.response = response ? Object.freeze(response) : null;
				return self.response;
			},
			function (err) {
				err.response = self.response;
				throw err;
			}
		);
		var dataPromise = respPromise.then(function (response) {
			return response ? (response.data || response.text) : null;
		});
		var promise = lib.delegate(dataPromise, {response: respPromise});
		var self    = this;

		this.response = null;
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
