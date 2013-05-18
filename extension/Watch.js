//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/declare",
				"../_base/Eventer",
				"../_base/Keys",
				"../_base/Library",
				"../dom/event/Event",
				"../error/createError!../error/StoreErrors.json",
				"../listener/ListenerList"
			 ], function (declare, Eventer, Keys, Lib, Event, createError, ListenerList) {
	"use strict";
	
	// module:
	//		IndexStore/extension/Watch
	// summary:

	var StoreError = createError( "Watch" );			// Create the StoreError type.
	var isString   = Lib.isString;
	
	var Watch = declare( null, {

		//=========================================================================
		// constructor
		
		constructor: function (kwArgs) {
			this._watchList = [];								// List of properties to watch for.
			this._spotters  = new ListenerList();
			
			// Add callback to the store.
			this._listeners.addListener( "write", this._watchProperty, this );
			if (this.eventer instanceof Eventer) {
				this.eventer.registerEvent("set");
			}
			if (!this._clone) {
				console.warn("Watch Extension only works when object cloning is enabled");
			}
			this.features.add("watch");

			Lib.protect( this );	// Hide own private properties.

		},

		//=========================================================================
		// Private methods

		_watchProperty: function (action, key, newObj, oldObj, at) {
			// summary:
			//		Test if any of the object properties being monitored have changed.
			//		This method is called immediately after the store is updated.
			// action: String
			// key: Key
			//		Object key
			// newObj: Object
			//		New object.
			// oldObj: Object
			//		Old object.
			// at: Number
			// tag:
			//		Private, callback
			
			function test(store, prop, newObj, oldObj ) {
				var newVal = Lib.getProp( prop, newObj );
				var oldVal = Lib.getProp( prop, oldObj );
				if (Keys.cmp(newVal, oldVal)) {
					// Notify all listeners.
					store._spotters.trigger(prop, newObj, prop, newVal, oldVal);
					// Create a DOM4 style custom event.
					if (this.eventable && !store.suppressEvents) {
						var props = {	item: newObj,	property: prop,	newValue: newVal, oldValue: oldVal};
						this.emit( "set", props, true );
					}
				}
			};
			
			if (this._watchList.length && at != -1 && oldObj) {
				this._watchList.forEach( function (prop) {
					test(this, prop, newObj, oldObj);
				}, this );
			}
		},

		//=========================================================================
		// Public IndexedStore/api/store API methods

		destroy: function () {
			this.inherited(arguments);
			this._watchList = [];
			this._spotters  = null;
		},
		
		watch: function (property, callback, thisArg) {
			// summary:
			//		Add a property to the list properties being monitored for change.
			//		If the specified property of an object changes a 'set' event will
			//		be generated and, if specified, the callback is notified.
			// property: String|String[]
			//		Property name or property path. A property path is dot-separated
			//		string of identifiers like 'a.b.c'.
			// callback: Function
			//		Callback, if specified the callback is called when the property of
			//		a store object changed. The signature of callback is as follows:
			//			callback( object, property, newValue, oldValue ) 
			//  thisArg: Object?
			//		Object to use as this when executing the callback.
			// tag:
			//		Public
			var self = this;

			if (property) {
				// An array of properties...
				if (property instanceof Array) {
					var handles = property.map( function (prop) {
						return this.watch(prop, callback);
					}, this );
					handles.remove = function () {
						handles.forEach( function (handle) {
							handle.remove();
						});
					};
					return handles;
				}
				// Comma separated list of properties.
				if (isString(property)) {
					if (/,/.test(property)) {
						return this.watch( property.split(/\s*,\s*/), callback );
					}
				}
				// Single property.
				if (Keys.validPath(property)) {
					if (this._watchList.indexOf(property) == -1) {
						this._watchList.push(property);
					}
					if (callback) {
						this._spotters.addListener( property, callback, thisArg );
					} else {
						if (!this.eventable) {
							throw new StoreError("ParameterMissing", "watch", "store is not eventable, callback required");
						}
					}
				} else {
					throw new StoreError("TypeError", "watch", "invalid property");
				}
				return {
					remove: function () {
						self.unwatch( property, listener );
					}
				}
			}
		},

		unwatch: function (property, callback) {
			// summary:
			//		Remove a property name from the list of properties being monitored.
			// property: String|String[]
			//		Property name or property path.
			// callback: Function|Listener
			//		Function or a Listener object. If a callback is specified only the
			//		specific callback is removed otherwise all available listeners for
			//		the property are removed.
			// tag:
			//		Public
			if (property) {
				if (property instanceof Array) {
					property.forEach( function(prop) {
						this.unwatch(prop, callback);
					}, this);
					return;
				}
				if (isString(property)) {
					if (/,/.test(property)) {
						return this.unwatch( property.split(/\s*,\s*/), callback );
					}
				}
				if (Keys.validPath(property)) {
					var spotters = this._spotters.getByType(property);
					var remProp  = true;
					if (spotters.length) {
						if (callback) {
							this._spotters.removeListener( property, callback);
						} else {
							this._spotters.clear(property);
						}
						remProp = !this._spotters.getByType(property).length;
					}
					if (remProp) {
						var index = Keys.indexOf(this._watchList, property);
						if ( index > -1) {
							this._watchList.splice(index,1);
						}
					}
				} else {
					throw new StoreError("TypeError", "watch", "invalid property");
				}
			}
		}

	});	/* end Watch {} */
	
	return Watch;

});	/* end define() */
