//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../_base/Library",
				"../error/createError!../error/StoreErrors.json"
			 ], function (Lib, createError) {

	// module:
	//		indexedStore/listener/Listener
	// summary:

	var StoreError = createError( "Listener" );		// Create the StoreError type.
	var mixin      = Lib.mixin;
	
	function Listener (callback, scope /*[,arg0 [,arg1, ..., argn]]*/) {
		// summary:
		//		Create a generic Listener object.
		// callback: Function|Listener|String
		//		A function, an instance of Listener or a function name. If callback 
		//		is an instance of Listener a new copy of the Listener is returned.
		//		If callback is a string it is considered a function name used for
		//		late binding. (See ListenerList.trigger for details).
		// scope: Object?
		//		Object to use as this when executing callback.
		// returns: Listener
		//		An new instance of a Listener object
		// tag:
		//		Public

		this.callback = null;

		if (arguments.length > 0) {
			if (callback instanceof Listener) {
				mixin (this, callback);
			} else if (typeof callback == "string" || callback instanceof String) {
				this.bind = callback;
			} else if (typeof callback == "function") {
				this.callback = callback;
			} else {
				throw new StoreError("TypeError", "Listener", "callback is not a callable object");
			}
			if (arguments.length > 2) {
				this.args = Array.prototype.slice.call(arguments,2);
			}
			if (scope) this.scope   = scope;

			// Define the DOM EventListener interface
			Lib.defProp( this, "handleEvent", { 
				get: function () { return this.callback; },
				enumerable: true
			});
		}
		return this;
	}
	
	return Listener;

});	/* end define() */
