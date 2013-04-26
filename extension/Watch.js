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
				"../_base/Callback",
				"../_base/Keys",
				"../_base/Library",
				"../_base/Listener",
				"../dom/event/Event",
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, Callback, Keys, Lib, Listener, Event, createError) {
	"use strict";
	
	// module:
	//		IndexStore/extension/Watch
	// summary:

	var StoreError = createError( "Watch" );			// Create the StoreError type.

	var Watch = {

		//=========================================================================
		// constructor
		
		constructor: function (kwArgs) {
			this._watchList = [];								// List of properties to watch for.
			this._spotters  = new Callback();
			
			var listener = new Listener( this._watchProperty, null, this );
			this._callbacks.add( "write", listener );		// Add callback to the store.
			this.features.add("watch");
			Lib.protect( this );	// Hide own private properties.

		},
		
		destroy: function () {
			this.inherited(arguments);
			this._watchList = [];
			this._spotters  = null;
		},
		
		//=========================================================================
		// Private methods

		_watchProperty: function (/*any*/ cbOpt,/*Key*/ key, /*Object*/ newObj, /*Object*/ oldObj,/*Number*/ at) {
			// summary:
			//		Test if any of the object properties being monitored have changed.
			//		This method is called immediately after the store is updated.
			// cbOpt:
			// key:
			//		Object key
			// newObj:
			//		New object.
			// oldObj:
			//		Old object.
			// tag:
			//		Private, callback
			
			function test(store, prop, newObj, oldObj ) {
				var newVal = Lib.getProp( prop, newObj );
				var oldVal = Lib.getProp( prop, oldObj );
				if (Keys.cmp(newVal, oldVal)) {
					// Notify all listeners.
					store._spotters.fire(prop, newObj, prop, newVal, oldVal);
					// Create a DOM4 style custom event.
					if (!store.suppressEvents) {
						var event = new Event("set", 
							{	detail: {	
								item: newObj,
								property: prop,
								newValue: newVal, 
								oldValue: oldVal }
							});
						store.dispatchEvent( event );
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

		watch: function (/*String|String[]*/property,/*Function?*/ listener,/*Object?*/ thisArg) {
			// summary:
			//		Add a property to the list properties being monitored for change.
			//		If the specified property of an object changes a 'set' event will
			//		be generated and, if specified, the listener is notified.
			// property:
			//		Property name or property path. A property path is dot-separated
			//		string of identifiers like 'a.b.c'.
			// listener:
			//		Callback, if specified the callback is called when the property of
			//		a store object changed. The signature of listener is as follows:
			//			listener( object, property, newValue, oldValue ) 
			//  thisArg:
			//		Object to use as this when executing the callback.
			// tag:
			//		Public
			var self = this;

			if (property) {
				// An array of properties...
				if (property instanceof Array) {
					var handles = property.map( function (prop) {
						return this.watch(prop, listener);
					}, this );
					handles.remove = function () {
						handles.forEach( function (handle) {
							handle.remove();
						});
					};
					return handles;
				}
				// Comma separated list of properties.
				if (property instanceof String || typeof property == "string") {
					if (/,/.test(property)) {
						return this.watch( property.split(/\s*,\s*/), listener );
					}
				}
				// Single property.
				if (Keys.validPath(property)) {
					if (this._watchList.indexOf(property) == -1) {
						this._watchList.push(property);
					}
					if (listener) {
						var listener = new Listener(listener, null, thisArg );
						this._spotters.add( property, listener );
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

		unwatch: function (/*String|String[]*/property,/*Function?*/ listener) {
			// summary:
			//		Remove a property name from the list of properties being monitored.
			// property:
			//		Property name or property path.
			// listener:
			//		If a listener is specified only the specific listener is removed
			//		otherwise all available listeners for the property are removed.
			// tag:
			//		Public
			if (property) {
				if (property instanceof Array) {
					property.forEach( function(prop) {
						this.unwatch(prop, listener);
					}, this);
					return;
				}
				if (property instanceof String || typeof property == "string") {
					if (/,/.test(property)) {
						return this.unwatch( property.split(/\s*,\s*/), listener );
					}
				}
				if (Keys.validPath(property)) {
					var spotters = this._spotters.getByType(property);
					var remProp  = true;
					if (spotters.length) {
						if (listener) {
							// Remove individual listener.
							if (listener instanceof Listener) {
								this._spotters.remove( property, listener);
							} else {
								listener = this._spotters.getByCallback(property, listener);
								if (listener) {
									this._spotters.remove( property, listener);
								}
							}
						} else {
							// Remove all listeners.
							spotters.forEach( function (listener) {
								this._spotters.remove(property, listener);
							}, this);
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

	};	/* end Hierarch {} */
	
	return declare( null, Watch );

});	/* end define() */
