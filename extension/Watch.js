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
				"../error/createError!../error/StoreErrors.json",
				"../listener/ListenerList"
			 ], function (declare, Eventer, Keys, Lib, createError, ListenerList) {
	"use strict";
	
	// module:
	//		IndexStore/extension/Watch
	// summary:

	var StoreError = createError( "Watch" );			// Create the StoreError type.
	var isString   = Lib.isString;
	var getProp    = Lib.getProp;
	
	function watchProperty (action, key, newObj, oldObj, at) {
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
		
		function test(store, prop, newObj, oldObj ) {
			var newVal = getProp( prop, newObj );
			var oldVal = getProp( prop, oldObj );
			if (Keys.cmp(newVal, oldVal)) {
				// Notify all listeners, if any.
				store._spotters.trigger(prop, newObj, newVal, oldVal);
				// Create a DOM4 style custom event.
				if (store.eventable && !store.suppressEvents) {
					var props = {	item: newObj,	property: prop,	newValue: newVal, oldValue: oldVal};
					store._emit( "set", props, true );
				}
			}
		};
		
		if (this._watchList.length && at != -1 && oldObj) {
			this._watchList.forEach( function (prop) {
				test(this, prop, newObj, oldObj);
			}, this );
		}
	}

	var Watch = declare( null, {

		//=========================================================================
		// constructor
		
		constructor: function (kwArgs) {
			this._spotters    = new ListenerList();
			this._watchHandle = null;
			this._watchList   = [];								// List of properties to watch for.
			
			// If this is an eventable store regsiter the 'set' event type creating
			// the 'onSet' method.  Note: the Watch extension does not register any
			// listener with the store until there is something to watch for.

			if (this.eventable && this.eventer instanceof Eventer) {
				this.eventer.registerEvent("set");
			}
			if (!this._clone) {
				console.warn("Watch Extension only works when object cloning is enabled");
			}
			this.features.add("watch");

			Lib.protect( this );	// Hide own private properties.

		},

		//=========================================================================
		// Public IndexedStore/api/store API methods

		destroy: function () {
			this.inherited(arguments);
			this._watchList = [];
			this._spotters  = null;
		},
		
		watch: function (property, listener, scope) {
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
			//			listener( object, property, newValue, oldValue )
			//		The listener argument is required if the store is not eventable.
			//		(See indexedStore/extension/Eventable)
			//  scope: Object?
			//		Object to use as this when executing the listener.
			// tag:
			//		Public
			var self = this;

			if (property) {
				// An array of properties...
				if (property instanceof Array) {
					property.forEach( function (prop) {
						this.watch( prop, listener );
					}, this);
				} else if (isString(property)) {
					if (/,/.test(property)) {
						return this.watch( property.split(/\s*,\s*/), listener );
					}
					// Single property.
					if (Keys.validPath(property)) {
						if (this._watchList.indexOf(property) == -1) {
							// register the listener with the store.
							if (!this._watchHandle) {
								this._watchHandle = this._register( "write", watchProperty, this );
							}
							this._watchList.push(property);
						}
						if (listener) {
							this._spotters.addListener( property, listener, scope );
						} else {
							if (!this.eventable) {
								throw new StoreError("ParameterMissing", "watch", "store is not eventable, listener required");
							}
						}
					} else {
						throw new StoreError("TypeError", "watch", "invalid property path");
					}
				} else {
					throw new StoreError("TypeError", "watch", "invalid property");
				}
				return {
					remove: function () {
						self.unwatch( property, listener, scope );
					}
				}
			}
		},

		unwatch: function (property, listener, scope) {
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
					property.forEach( function(prop) {
						this.unwatch(prop, listener, scope);
					}, this);
					return;
				}
				if (isString(property)) {
					if (/,/.test(property)) {
						return this.unwatch( property.split(/\s*,\s*/), listener, scope );
					}
				}
				if (Keys.validPath(property)) {
					this._spotters.removeListener(property, listener, scope);
					if (!this._spotters.getByType(property).length) {
						var index = Keys.indexOf(this._watchList, property);
						if ( index > -1) {
							this._watchList.splice(index,1);
							if (!this._watchList.length) {
								// Unregister from the store...
								this._watchHandle.remove();
								this._watchHandle = null;
							}
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
