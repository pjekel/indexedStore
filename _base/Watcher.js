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
	], function (createError, ListenerList, Keys, lib) {
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

		var handle   = null;
		var propList = [];
		var spotters = new ListenerList();
		var self     = this;

		function watchProperty(action, key, newObj, oldObj, at) {
			// summary:
			//		Test if any of the object properties being monitored have changed.
			//		This method is called immediately after the store is updated.
			// action: String
			//		Store operation performed, always "write'
			// key: Key
			//		Object key
			// newObj: Object
			//		New object.
			// oldObj: Object
			//		Old object.
			// at: Number
			// tag:
			//		Private, callback

			function test(store, prop, newObj, oldObj) {
				var newVal = getProp(prop, newObj);
				var oldVal = getProp(prop, oldObj);
				if (Keys.cmp(newVal, oldVal)) {
					// Notify all listeners, if any.
					spotters.trigger(prop, newObj, newVal, oldVal);
					// Create a DOM4 style custom event.
					if (store.eventable && !store.suppressEvents) {
						var props = {	item: newObj,	property: prop,	newValue: newVal, oldValue: oldVal};
						store._emit("set", props, true);
					}
				}
			}
			// Only inspect updated objects, ignore new or deleted objects
			if (propList.length && at != -1 && oldObj) {
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
			//		Property name(s) for which the listeners are returned. If ommitted
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
			//		The listener argument is required if the store is not eventable.
			//		(See indexedStore/extension/Eventable)
			//  scope: Object?
			//		Object to use as this when executing the listener.
			// tag:
			//		Public

			if (property) {
				if (property instanceof Array) {
					property.forEach(function (prop) {
						self.watch(prop, listener);
					});
				} else if (isString(property)) {
					if (/,/.test(property)) {
						return self.watch(property.split(/\s*,\s*/), listener);
					}
					// Single property.
					if (Keys.validPath(property)) {
						if (listener) {
							spotters.addListener(property, listener, scope);
						} else {
							if (!source.eventable) {
								throw new StoreError("ParameterMissing", "watch", "store is not eventable, listener required");
							}
						}
						if (propList.indexOf(property) == -1) {
							// register the listener with the store.
							if (!handle) {
								handle = source._register("write", watchProperty);
							}
							propList.push(property);
						}
					} else {
						throw new StoreError("DataError", "watch", "invalid property path");
					}
				} else {
					throw new StoreError("TypeError", "watch", "invalid property");
				}
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
			// listener: Function|Listener
			//		Function or a Listener object. If a listener is specified only the
			//		specific listener is removed otherwise all available listeners for
			//		the property are removed.
			// tag:
			//		Public
			if (property) {
				if (property instanceof Array) {
					property.forEach(function (prop) {
						self.unwatch(prop, listener, scope);
					});
					return;
				}
				if (isString(property)) {
					if (/,/.test(property)) {
						return self.unwatch(property.split(/\s*,\s*/), listener, scope);
					}
				}
				if (Keys.validPath(property)) {
					spotters.removeListener(property, listener, scope);
					if (!spotters.getByType(property).length) {
						var index = propList.indexOf(property);
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
			}
		};

		//======================================================================

		if (source && source.type == "store") {
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
