define(["dojo/_base/declare",
				"./Library",
				"../dom/event/Event",
				"../dom/event/EventTarget",
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, Lib, Event, EventTarget, createError) {
	"use strict";
	
	// module
	//		indexedStore/_base/Eventer
	// summary:
	// interface:
	//		interface Eventer {
	//			void registerEvent ((string or sequence<string>) type);
	//			void emit (string type, optional object properties, optional boolean custom);
	//		}

	var StoreError = createError("Eventer");		// Create the StoreError type.
	var isObject   = Lib.isObject;
	var isString   = Lib.isString;
	
	function Eventer(source, types) {
		// summary:
		// source: EventTarget
		// types: String|String[]?
		
		function removeListeners(source, type) {
			// summary:
			//		Remove the current event listener for the given type unless it is
			//		the dummy listener, which will always be the first in the list.
			//		Preserving the dummy listener guarantees advice can still be added
			//		if required.
			// source: EventTarget
			// type: type
			//		Event type.
			// tag:
			//		Private
			var i, listeners = source.getEventListeners(type);
			// Keep the dummy listener so advice can still be added....
			if (listeners && listeners.length > 1) {
				source.removeEventListener( type, callbacks[type] );
			}
		}
	
		this.registerEvent = function (type) {
			// summary:
			//		Register an event with the store.
			// description
			//		Register an event with the store. Registering an event will create
			//		an empty store function called on<type>. For example registering a
			//		event type 'error' creates the store function onerror(). The new
			//		function can then be used to add advice. However, using the newly
			//		created function in an assignment will actually register an event
			//		listener.
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
									removeListeners( source, type );
									source.addEventListener( type, callback );
									callbacks[type] = callback;
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

		this.emit = function (type, properties, custom) {
			// summary:
			// type: String
			// properties: Object?
			// custom: Boolean?
			// tag:
			//		Public
			var props = properties;
			if (type && isString(type)) {
				if (custom && props) {
					var custProp = props;
					if (!props.detail) {
						custProp = {
							cancelable: !!props.cancelable,
							bubbles: !!props.bubbles,
							detail: props
						};
						delete  props.cancelable;
						delete  props.bubbles;
					}
					props = custProp;
				}
				source.dispatchEvent( new Event (type, props) );
			} else {
				throw new StoreError( "TypeError", "emit", "invalid type property");
			}
		};

		//=======================================================================
		var callbacks = {};
		
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