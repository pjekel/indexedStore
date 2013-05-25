define(["dojo/_base/declare",
				"./Library",
				"../dom/event/Event",
				"../dom/event/EventTarget",
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, Lib, Event, EventTarget, createError) {
	"use strict";
	
	var StoreError = createError("Eventer");		// Create the StoreError type.
	var isObject   = Lib.isObject;
	var isString   = Lib.isString;
	
	function removeListeners(source, type) {
		// summary:
		// source: EventTarget
		// type: type
		var listeners = source.getEventListeners(type);
		if (listeners) {
			listeners.forEach( function (listener) {
				source.removeEventListener( type, listener );
			});
		}
	}
	
	function Eventer(source, types) {
		// summary:
		// source: EventTarget
		// types: String|String[]?
		
		this.registerEvent = function (type) {
			// summary:
			// type: String
			// tag:
			//		Public
			if (type instanceof Array) {
				type.forEach( function (type) {
					this.registerEvent(type);
				}, this);
			} else if (isString(type)) {
				if (/,/.test(type)) {
					this.registerEvent(type.split(/\s*,\s*/));
				} else {
					var prop = "on" + type.toLowerCase();
					Lib.defProp( source, prop, {
						get: function () {
									 var listener = source.getEventListeners(type)[0];
									 if (listener) {
										 return listener.listener;
									 }
								 },
						set: function (callback) {
									 if (callback !== null) {
										 if (callback instanceof Function) {
											 source.addEventListener( type, callback );
										 } else {
											 throw new StoreError("TypeError", "register", "callback is not a callable object");
										 }
									 } else {
										 removeListeners( source, type );
									 }
								 },
						configurable: false,
						enumerable: true
					});
					// Add a dummy placeholder function so users can add advice....
					source[prop] = function () {};
				}
			} else {
				 throw new StoreError("TypeError", "register", "invalid type");
			}
		};

		this._emit = function (type, properties, custom) {
			// summary:
			// type: String
			// properties: Object?
			// custom: Boolean?
			// tag:
			//		Public
			if (type && isString(type)) {
				if (!source.suppressEvents) {
					if (custom) {
						var custProp = properties;
						if (!properties.detail) {
							custProp = {
								cancelable: !!properties.cancelable,
								bubbles: !!properties.bubbles,
								detail: properties
							};
							delete  properties.cancelable;
							delete  properties.bubbles;
						}
						properties = custProp;
					}
					var event = new Event (type, properties);
					source.dispatchEvent( event );
				}
			} else {
				throw new StoreError( "TypeError", "emit", "invalid type property");
			}
		}

		if (source instanceof EventTarget) {
			if (types) {
				this.registerEvent(types);
			}
		} else {
			throw new StoreError( "DataError", "constructor", "source must be an instance of EventTarget");
		}
	}	/* end Eventer() */
	
	return Eventer;
});