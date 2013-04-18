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
				"../_base/Keys",
				"../_base/Library",
				"../dom/event/Event"
			 ], function (declare, Keys, Lib, Event) {
	"use strict";
	
	// module:
	//		store/extension/Watch
	// summary:

	var Watch = {

		//=========================================================================
		// constructor
		
		constructor: function (kwArgs) {
			this._watchList = [];			// List of properties to watch for.

			this._addCallback( this._watchProperty );		// Add callback to the store.
			Lib.protect( this );	// Hide own private properties.

		},
		
		//=========================================================================
		// Private methods

		_watchProperty: function (/*Key*/ key,/*Number*/ at,/*Object*/ newValue,
		                           /*Object*/ oldValue,/*Store.PutDirectives*/ options ) {
			// summary:
			//		Test if any of the object properties being monitored have changed.
			// key:
			//		Record key value.
			// at:
			//		Record index number. -1 incase of a new object.
			// newValue:
			//		New value portion (user object) of a record.
			// oldValue:
			//		Old value portion (user object) of a record.
			// options:
			// tag:
			//		Private, callback
			
			function test(store, prop, newValue, oldValue ) {
				var newVal = Lib.getProp( prop, newValue );
				var oldVal = Lib.getProp( prop, oldValue );
				if (Keys.cmp(newVal, oldVal)) {
					// Create a DOM4 style custom event.
					var event = new Event("set", 
						{	detail: {	
							item: newValue,
							property: prop,
							newValue: newVal, 
							oldValue: oldVal }
						 });
					store.dispatchEvent( event );
				}
			};
			
			if (!this.suppressEvents && at != -1 && oldValue) {
				this._watchList.forEach( function (prop) {
					if (!(prop instanceof RegExp)) {
						test(this, prop, newValue, oldValue );
					} else {
						for (var property in newValue) {
							if (prop.test(property)) {
								test(this, property, newValue, oldValue );
							}
						}
					}
				}, this );
			}
		},

		//=========================================================================
		// Public cbtree/store/api/store API methods

		watch: function (/*RegExp|String|String[]*/property) {
			// summary:
			//		Add a property to the list properties being monitored for change.
			//		If the specified property of an object changes a 'set' event will
			//		be generated.
			// property:
			//		Regular expression, property name or property path. A property path
			//		is dot-separated string of identifiers like 'a.b.c'.
			// tag:
			//		Public
			if (property) {
				if (property instanceof Array) {
					return property.forEach( this.watch, this );
				}
				if (typeof property == "string") {
					if (/,/.test(property)) {
						return this.watch( property.split(/\s*,\s*/) );
					} 
					if (this._watchList.indexOf(property) == -1) {
						this._watchList.push(property);
					}
				} else if (property instanceof RegExp) {
					this._watchList.push(property);
				}
			}
		},

		unwatch: function (/*String|String[]*/property) {
			// summary:
			//		Remove a property name from the list of properties being monotored.
			// property:
			//		Regular expression, property name or property path.
			// tag:
			//		Public
			if (property) {
				if (property instanceof Array) {
					return property.forEach( this.watch, this );
				}
				if (typeof property == "string") {
					if (/,/.test(property)) {
						return this.watch( property.split(/\s*,\s*/) );
					}
				}
				// NOTE: Keys.indexOf() will also locate RegExp in an array.
				var index = Keys.indexOf(this._watchList, property);
				if ( index > -1) {
					this._watchList.splice(index,1);
				}
			}
		}

	};	/* end Hierarch {} */
	
	return declare( null, Watch );

});	/* end define() */
