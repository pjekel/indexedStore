//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../error/createError!../error/StoreErrors.json"], function (createError) {

	// module:
	//		store/_base/Listener
	// summary:

	var StoreError = createError( "Listener" );		// Create the StoreError type.

	function Listener (callback, options, thisArg) {
		// summary:
		//		Create a Listener object.
		// callback: Function
		//		Callback function 
		// options: Object?
		//		A JavaScript key:value pairs object. The object properties may vary
		//		based on the listener type. The options are passed to the callback
		//		as the first argument.
		// thisArg: Object?
		//		Object to use as this when executing callback.
		// returns: Listener
		//		An new instance of a Listener object
		// tag:
		//		Private
		if (typeof callback != "function") {
			throw new StoreError("TypeError", "Listener", "listener is not a callable object");
		}
		this.callback = callback;
		this.options  = options;
		this.scope    = thisArg;
	}
	
	return Listener;

});	/* end define() */
