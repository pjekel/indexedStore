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

	function Listener (/*Function*/ callback,/*Object*/ options,/*Object*/ thisArg) {
		// summary:
		//		Create a Listener object.
		// callback:
		//		Callback function 
		// options:
		//		A JavaScript key:value pairs object. The object properties may vary
		//		based on the listener type.
		// thisArg:
		//		Object to use as this when executing callback.
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
