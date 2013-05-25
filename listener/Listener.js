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
	"use strict";
	
	// module:
	//		indexedStore/listener/Listener
	// summary:

	var StoreError = createError( "Listener" );		// Create the StoreError type.
	var isString   = Lib.isString;
	var mixin      = Lib.mixin;
	var undef;
	
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

		// calling Listener() or new Listener() has the same effect.
		if (!(this instanceof Listener)) {
			return Listener.apply(new Listener(), arguments);
		}
		this.listener = callback;
		if (arguments.length > 0) {
			if (callback instanceof Listener) {
				mixin (this, callback);
			} else if (isString(callback)) {
				// allow for late binding.
				this.bindName = callback;
				this.listener = undef;
			}
			if (this.listener && !(this.listener instanceof Function)) {
				throw new StoreError("TypeError", "Listener", "callback is not a callable object");
			}
			if (arguments.length > 2) {
				// save optional arguments...
				this.args = Array.prototype.slice.call(arguments,2);
			}
			if (scope) this.scope = scope;
		}
		return this;
	}
	
	return Listener;

});	/* end define() */
