//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../error/createError!../error/StoreErrors.json",
		"../listener/ListenerList",
		"./Keys",
		"./library",
		"./opcodes"
	], function (createError, ListenerList, Keys, lib, opcodes) {
	"use strict";

	// module:
	//		IndexStore/_base/Watcher
	// description:
	//		A Watcher instance monitors store object for changes to specific object
	//		properties. Whenever a store object is updated the Watcher inspects the
	//		object for changes to the properties that have been registered with the
	//		Watcher.
	//		There are two ways an application can get notified of object changes:
	//
	//			1 - Register the property with the Watcher specifying a listener.
	//			2 - Register the property without a listener and instead register an
	//			    common event handler for the "set" event.
	//
	// interface:
	//		[Constructor(Store store)]
	//		interface Watcher {
	//			read-only		attribute	sequence<string> properties;
	//			void destroy ();
	//			sequence<Listener> getListeners (optional (string or sequence<string>) property);
	//			Handle watch ((string or sequence<string>) property,
	//			              optional Listener listener,
	//			              optional object scope);
	//			void unwatch ((string or sequence<string>) property,
	//			              optional Listener listener,
	//			              optional object scope);
	//		};
	//		interface Handle {
	//			void remove ();
	//		};
	//
	// example:
	//	|	require(["./Watcher", ... ], function ( Watcher, ... ) {
	//	|		var myStore = new Store( ... );
	//	|		var spotter = new Watcher( store );
	//	|
	//	|		function itemChanged (prop, item, newVal, oldVal ) {
	//	|			console.log(item.name," property: ",prop," has changed");
	//	|		}
	//	|		var handle = spotter.watch("hair", itemChanged );
	//	|					...
	//	|		handle.remove();
	//	|		spotter.destroy();
	//	|	});
	//
	//	|	require(["./Watcher", ... ], function ( Watcher, ... ) {
	//	|		var myStore = new Store( ... );
	//	|		var spotter = new Watcher( store );
	//	|
	//	|		function itemChanged (event) {
	//	|			var details = event.details;
	//	|			console.log(details.item.name," property: ",details.property," has changed");
	//	|		}
	//	|		spotter.watch("hair");
	//	|		store.on("set", itemChanged);
	//	|	         ...
	//	|		handle.remove();
	//	|		spotter.destroy();
	//	|	});

	var StoreError = createError("Watcher");			// Create the StoreError type.
	var isString   = lib.isString;
	var defProp    = lib.defProp;
	var getProp    = lib.getProp;

	function Watcher(source) {
		// summary:
		//		Create a new instance of a Watcher object.
		// source: Store
		//		The store to monitor.
		// tag:
		//		public

		function watchProperty(action, key, newObj, oldObj) {
			// summary:
			//		Test if any of the object properties being monitored have changed.
			//		This method is called immediately after the store is updated.
			// action: String
			//		Store operation performed. (always opcodes.UPDATE)
			// key: Key
			//		Object key
			// newObj: Object
			//		New object.
			// oldObj: Object
			//		Old object.
			// tag:
			//		Private, callback

			function test(store, prop, newObj, oldObj) {
				var newVal = getProp(prop, newObj);
				var oldVal = getProp(prop, oldObj);
				var props;
				
				if (Keys.cmp(newVal, oldVal)) {
					// Notify all listeners, if any.
					spotters.trigger(prop, newObj, newVal, oldVal);
					if (store.eventable && !store.suppressEvents) {
						props = {item: newObj, property: prop, newValue: newVal, oldValue: oldVal};
						store.emit("set", props, true);
					}
				}
			}

			if (propList.length) {
				propList.forEach(function (prop) {
					test(source, prop, newObj, oldObj);
				});
			}
		}

		//======================================================================
		// Public methods

		this.destroy = function () {
			// summary:
			// tag:
			//		public
			spotters.removeListener();
			handle && handle.remove();
		};

		this.getListeners = function (property) {
			// summary:
			//		Return the list of listeners registered with the Watcher instance
			//		for a given property.
			// property?
			//		Property name(s) for which the listeners are returned. If omitted
			//		all listeners are returned.
			// returns: Object|Listener[]
			//		If the property argument is specified an array of all listeners for
			//		the given property otherwise a key:value pairs object with each key
			//		representing a property and the value being an array of listeners
			//		for that property.
			// tag:
			//		public
			return spotters.getByType(property);
		};

		this.watch = function (property, listener, scope) {
			// summary:
			//		Add a property to the list properties being monitored for change.
			//		If the specified property of an object changes a 'set' event will
			//		be generated and, if specified, the listener is notified.
			// property: String|String[]
			//		Property name or property path. A property path is dot-separated
			//		string of identifiers like 'a.b.c'.
			// listener: Function?
			//		Callback, if specified the listener is called when the property of
			//		a store object changed. The signature of listener is as follows:
			//			listener(object, property, newValue, oldValue)
			//
			//		THE LISTENER ARGUMENT IS REQUIRED IF THE STORE IS NOT EVENTABLE.
			//  scope: Object?
			//		Object to use as this when executing the listener.
			// returns: Object
			//		An object which has a remove method which can be called to remove
			//		the listener from the ListenerList.
			// tag:
			//		Public

			if (property) {
				var props = lib.anyToArray(property);
				props.forEach(function (prop) {
					if (Keys.validPath(prop)) {
						if (listener) {
							spotters.addListener(prop, listener, scope);
						} else {
							if (!source.eventable) {
								throw new StoreError("ParameterMissing", "watch", "store is not eventable, listener required");
							}
						}
						if (propList.indexOf(prop) == -1) {
							// Now that we have something to watch for, register the
							// listener for store updates.
							if (!handle) {
								handle = source._register(opcodes.UPDATE, watchProperty);
							}
							propList.push(prop);
						}
					} else {
						throw new StoreError("DataError", "watch", "invalid property path");
					}
				});
				return {
					remove: function () {
						self.unwatch(property, listener, scope);
					}
				};
			}
		};

		this.unwatch = function (property, listener, scope) {
			// summary:
			//		Remove a property name from the list of properties being monitored.
			// property: String|String[]
			//		Property name or property path.
			// listener: Function|Listener?
			//		Function or a Listener object. If a listener is specified only the
			//		specific listener is removed otherwise all available listeners for
			//		the property are removed.
			// scope: Object?
			//		The scope associated with the listener. The scope argument is only
			//		required when the listener argument is a string, in all other cases
			//		scope is ignored.
			// tag:
			//		Public
			if (property) {
				var props = lib.anyToArray(property);
				props.forEach(function (prop) {
					if (Keys.validPath(prop)) {
						spotters.removeListener(prop, listener, scope);
						if (!spotters.getByType(prop).length) {
							var index = propList.indexOf(prop);
							if (index > -1) {
								propList.splice(index, 1);
								if (!propList.length) {
									// Unregister from the store...
									handle.remove();
									handle = null;
								}
							}
						}
					} else {
						throw new StoreError("TypeError", "watch", "invalid property");
					}
				});
			}
		};

		//======================================================================

		var handle   = null;
		var propList = [];
		var spotters = new ListenerList();
		var self     = this;

		if (source && source.baseClass == "store") {
			defProp(this, "properties", {
				get: function () {
					return propList;
				},
				enumerable: true
			});
		} else {
			throw new StoreError("DataError", "constructor", "invalid source");
		}
	}
	return Watcher;
});	/* end define() */
