//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["./Listener",				
				"../error/createError!../error/StoreErrors.json"
			 ], function (Listener, createError) {
	"use strict";
	// module:
	//		indexedStore/_base/Callback
	// summary:

	var StoreError = createError( "Callback" );		// Create the StoreError type.

	function Callback () {
		var callbacks = [];
		var self = this;

		this.add = function (type, listener) {
			// summary:
			// type: String
			// listener: Listener
			// tag:
			//		Public
			if (listener instanceof Listener) {
				if (type instanceof String || typeof type == "string") {
					if (/,/.test(type)) {
						type = type.split(/\s*,\s*/);
					}
				}
				if (type instanceof Array) {
					type.forEach( function(type) {
						this.add(type, listener);
					}, this);
					return;
				}
				self.remove( type, listener );
				var cbByType = callbacks[type] || [];
				listener.type = type;
				cbByType.push(listener);
				callbacks[type] = cbByType;
				self.length++;

				return {
					remove: function () {
						self.remove( type, listener );
					}
				}
			}
		};

		this.clear = function () {
			self.length = 0;
			callbacks   = [];
		};

		this.fire = function (type) {
			// summary:
			//		Call every callback registered for the given type.  This method
			//		does NOT pass the optional listener options as the first argument.
			//		See also fireWithOptions().
			// type: String
			// tag:
			//		Public
			var cb = callbacks[type];
			if (cb) {
				var i, T, l, a = Array.prototype.slice.call(arguments, 1);
				for (i=0; i<cb.length;i++) {
					l = cb[i], T = l.scope;
					l.callback.apply( T, a );
				}
			}
		};

		this.fireWithOptions = function (type) {
			// summary:
			//		Call every callback registered for the given type.  The optional
			//		listener options are passed to the callback as the first argument.
			//		See also fire().
			// type: String
			// tag:
			//		Public
			var cb = callbacks[type];
			if (cb) {
				var i, T, l, a = Array.prototype.slice.call(arguments);
				for (i=0; i<cb.length;i++) {
					l = cb[i], T = l.scope;
					a[0] = l.options;
					l.callback.apply( T, a );
				}
			}
		};

		this.getByType = function (type) {
			// summary:
			// type: String
			// tag:
			//		Public
			var list = callbacks[type] || [];
			return list.slice();
		};

		this.getByCallback = function (type, callback) {
			if (typeof callback == "function") {
				var cbByType = callbacks[type];
				var listener;
				
				if (cbByType) {
					cbByType.some( function (handler, idx) {
						if (handler.callback == callback) {
							listener = cbByType[idx];
							return true;
						}
					});
				}
				return listener;
			}
		}
		
		this.remove = function (type, listener) {
			// summary:
			// type: String
			// listener: Listener
			// tag:
			//		Public
			if (listener instanceof Listener) {
				if (type instanceof String || typeof type == "string") {
					if (/,/.test(type)) {
						type = type.split(/\s*,\s*/);
					}
				}
				if (type instanceof Array) {
					type.forEach( function(type) {
						this.remove(type, listener);
					}, this);
					return;
				}
				var cbByType = callbacks[type];
				if (cbByType) {
					cbByType.some( function (handler, idx) {
						if (handler.callback == listener.callback) {
							cbByType.splice(idx, 1);
							self.length--;
							return true;
						}
					});
					if (!cbByType.length) {
						delete callbacks[type];
					}
				}
			} else {
				throw new StoreError("TypeError", "remove", "invalid listener");
			}
		};

		this.length = 0;

	}
	return Callback;
	
});	/* end define() */
