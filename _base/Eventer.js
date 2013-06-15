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
	//
	// interface:
	//		[Constructor(EventTarget source, optional (string or sequence<string>) types)]
	//		interface Eventer {
	//			read-only	attribute	sequence<string> events;
	//			void destroy ();
	//			void addHandler ((string or sequence<string>) type);
	//			void emit (string type, optional object properties, optional boolean custom);
	//		}
	//
	// example:
	//	|	require(["./Eventer", ... ], function (Eventer, ... ) {
	//	|		store.eventer = new Eventer();
	//	|		store.eventer.register("delete", "new", "update");
	//	|		store.emit = store.eventer.emit;
	//	|	});

	var StoreError = createError("Eventer");		// Create the StoreError type.
	var isObject   = Lib.isObject;
	var isString   = Lib.isString;
	var defProp    = Lib.defProp;
	
	function Eventer(source, types) {
		// summary:
		// source: EventTarget
		// types: String|String[]?
		
		function removeHandler(source, type) {
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
	
		this.destroy = function () {
			// summary:
			// tag:
			//		public
			var types = Object.keys(callbacks);
			types.forEach( function (type) {
				source.removeEventListener(type);
				delete source["on"+type];
			});
			callbacks = {};
		};
		
		this.addHandler = function (type) {
			// summary:
			//		Add an event handler to the store.
			// description
			//		Add an event handler to the store.  Adding an event handler adds
			//		a method to the store with the name: on<type>. For example adding
			//		a handler for type 'error' adds the store function onerror(). The
			//		new function can then be used to add advice. However, assigning a
			//		new function to a store property on<xxx> will actually register
			//		an event listener.
			// type: String
			// example:
			//	|	var eventer = new Eventer(someObj, "abort, error, complete");
			//	|	someObj.onerror = function (event) {
			//	|	  console.log(event.type,":",event.error);
			//	| };
			//	|	someObject.emit("error", {bubbles:true, error: new Error("SayWhat")});
			// tag:
			//		Public
			if (type instanceof Array) {
				type.forEach( function (type) {
					this.addHandler(type);
				}, this);
			} else if (isString(type)) {
				if (/,/.test(type)) {
					this.addHandler(type.split(/\s*,\s*/));
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
									removeHandler( source, type );
									source.addEventListener( type, callback );
									callbacks[type] = callback;
								} else {
									throw new StoreError("TypeError", "register", "callback is not a callable object");
								}
							} else {
								removeHandler( source, type );
							}
						},
						configurable: true,
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
			//		Dispatch an event.
			// type: String
			// properties: Object?
			// custom: Boolean?
			// returns: Event
			//		The event AFTER it has been dispatched. The event may have an error
			//		property in case an exception occurred while dispatching the event.
			// tag:
			//		Public
			var event, props = properties;
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
				event = new Event (type, props);
				source.dispatchEvent( event );
				return event;
			} else {
				throw new StoreError( "TypeError", "emit", "invalid type property");
			}
		};

		//=======================================================================
		var callbacks = {};
		
		if (source instanceof EventTarget) {
			if (types) {
				this.addHandler(types);
			}
			defProp(this, "events", {
				get: function () {
					return Object.keys(callbacks);
				},
				enumerable: true
			});
		} else {
			throw new StoreError( "DataError", "constructor", "source must be an instance of EventTarget");
		}
	}	/* end Eventer() */
	
	return Eventer;
});