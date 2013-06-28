//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/request/handlers",
		"../_base/library",
		"../error/createError!../error/StoreErrors.json"
	], function (handlers, lib, createError) {
	"use strict";

	// module
	//		indexedStore/handler/register
	// summary:
	//		Register a data handler with dojo/request.
	// description:
	//		Register a data handler with dojo/request. In addition to any plain
	//		handlers, this module also supports handlers that require a closure
	//		or scope. For example:
	//
	//			function closure () {
	//				this.handler = function (response) {
	//						...
	//				};
	//			}
	//			register("myType", closure);
	//
	//		In the above example, when the handler is called the this argument
	//		in the handler body refers to 'closure'.
	//
	// IMPORTANT:
	//		REGARDLESS IF A HANDLER HAS A CLOSURE OR NOT, BOTH THE CLOSURE AND
	//		HANDLER MUST BE ABLE TO HANDLE CALLS WITH ZERO ARGUMENTS. THEREFORE
	//		YOUR HANDLER SHOULD LOOK LIKE:
	//
	//			function handler(response) {
	//				if (response) {
	//					...
	//				}
	//			}

	var StoreError = createError("register");		// Create the StoreError type.
	var isObject   = lib.isObject;
	var mixin      = lib.mixin;

	function register(name, dataHandler) {
		// summary:
		//		Register a data handler.
		// name: String
		//		The symbolic name of the handler. After registration the name can
		//		be used as the value of the loader's 'handleAs' options property.
		// handler: Function|Object
		//		The data handler for the data/response. If handler is an key:value
		//		pairs object, the object MUST have a 'handler' property whose value
		//		is a function and optionally has a 'set' property as in:
		//
		//			{ handler: function ( ... ) { ... },
		//			  set: function (property, value) { ... }
		//			}
		//
		//		When a load request is successful the data handler is called with a
		//		response argument. The response argument is a JavaScript key:value
		//		pairs object with at least a 'text' property.
		//
		//		(See indexedstore/handler/csvHandler.js for an example handler).
		// tag:
		//		Public

		function getClosure(any) {
			// summary:
			//		Get the closure/scope, if any, for the handler.
			// any: Function|Object
			// tag:
			//		private
			if (typeof any == "function") {
				any = new any()
				if (any.handler) {
					return any;
				}
			} else if (any.handler) {
				return getClosure(any.handler) || any;
			}
		}

		var closure, options, setter;
		var handler = dataHandler;

		if (typeof dataHandler == "function") {
			dataHandler = new dataHandler();
		}
		if (isObject(dataHandler)) {
			options = dataHandler.options;
			name    = dataHandler.name || name;
			closure = getClosure(dataHandler);
			if (closure) {
				handler = closure.handler;
				setter  = closure.set;
				name    = name || closure.name;
			}
		}
		if (name) {
			if (typeof handler == "function") {
				handlers.register(name, handler.bind(closure));
				if (closure && options) {
					if (setter) {
						setter.call(closure, options);
					} else {
						mixin(closure, options);
					}
				}
				return closure || handler;
			}
			throw new StoreError("DataError", "register", "handler is not a callable object");
		}
		throw new StoreError("DataError", "register", "handler requires a name");
	}	/* end register() */
	return register;
});
