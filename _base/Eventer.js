//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["./library",
		"../dom/event/Event",
		"../dom/event/EventTarget",
		"../error/createError!../error/StoreErrors.json"
	], function (lib, Event, EventTarget, createError) {
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
	//	|		store.eventer = new Eventer(store, "delete, new, update");
	//	|		store.emit = store.eventer.emit;
	//	|	});

	var StoreError = createError("Eventer");		// Create the StoreError type.
	var isString   = lib.isString;

	function Eventer(source, types) {
		// summary:
		// source: EventTarget
		// types: String|String[]?
		//		A string or a comma-separated-value string or an array of strings
		//		specifying the event type(s) for which an handler entry is declared.
		// tag:
		//		public
		var eventTypes = [];

		this.destroy = function () {
			// summary:
			//		Remove the listeners associated with the event types that have
			//		been registered with this eventer instance.  Assigning null to
			//		the store event handler property will remove the handler.
			// tag:
			//		public
			eventTypes.forEach(function (type) {
				var propName = "on" + type;
				source[propName] = null;
				delete source[propName];
			});
		};

		this.addHandler = function (type) {
			// summary:
			//		Add an event handler property to the store.
			// description
			//		Add an event handler to the store.  Adding an event handler adds
			//		a special property to the store with the name: on<type>.
			//		The new property can be assigned a function with a prototype of:
			//			function handler(event) {}
			//		Assigning the property a function will register the function as
			//		an event listener for the specified type.
			//		(See also indexedStore/dom/event/EventTarget.declareHandler())
			// type: String
			// example:
			//	|	var eventer = new Eventer(someObj, "abort, error, complete");
			//	|	someObj.onerror = function (event) {
			//	|	  console.log(event.type,":",event.error);
			//	|	};
			//	|	eventer.emit("error", {bubbles:true, error: new Error("SayWhat")});
			// tag:
			//		Public
			var types = lib.anyToArray(type);
			types.forEach(function (eventType) {
				if (isString(eventType)) {
					var type = eventType.toLowerCase();
					if (eventTypes.indexOf(type) == -1 && !source.hasOwnProperty(type)) {
						EventTarget.declareHandler(source, type);
						eventTypes.push(type);
					}
				} else {
					throw new StoreError("TypeError", "addHandler", "invalid type argument");
				}
				eventTypes.sort();
			});
		};

		this.emit = function (type, properties, custom) {
			// summary:
			//		Dispatch an event.
			// type: String
			// properties: Object?
			// custom: Boolean?
			// returns: Boolean
			//		If true, the event was dispatched successfully otherwise the
			//		event was canceled and the defaults action(s) associated with
			//		the event, if any, were skipped.
			// tag:
			//		Public
			var event, props = properties;
			if (!type || !isString(type)) {
				throw new StoreError("TypeError", "emit", "invalid type argument");
			}
			if (custom && props) {
				var custProp = props;
				if (!props.detail) {
					custProp = {
						cancelable: !!props.cancelable,
						bubbles: !!props.bubbles,
						detail: props
					};
					delete props.cancelable;
					delete props.bubbles;
				}
				props = custProp;
			}
			event = new Event(type, props);
			return source.dispatchEvent(event);
		};

		//=======================================================================

		if (source instanceof EventTarget) {
			if (types) {
				this.addHandler(types);
			}
			lib.defProp(this, "events", {
				get: function () {
					return eventTypes;
				},
				enumerable: true
			});
		} else {
			throw new StoreError("DataError", "constructor", "source is  not an EventTarget");
		}
	}	/* end Eventer() */

	return Eventer;
});