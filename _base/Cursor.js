//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/lang",
				"./Keys",
				"./KeyRange",
				"./Library",
				"./Location",
				"../error/createError!../error/StoreErrors.json"
			], function(lang, Keys, KeyRange, Lib, Location, createError){
	"use strict";

	// module:
	//		store/_base/Cursor
	// summary:
	//		Cursors are a transient mechanism used to iterate over multiple records
	//		in a store. Storage operations are performed on the underlying index or
	//		object store. This module implements the IDBCursorSync interface:
	//
	//			http://www.w3.org/TR/IndexedDB/#cursor-sync
	//
	//		Cursors are supported on store/_Indexed based stores and any index. In
	//		addition, cursors can be passed directly to the store's query engine.
	//		For example:
	//
	//	|	var range  = KeyRange.bound("Bart", "Homer");
	//	| var cursor = store.openCursor( range );
	//	| var query  = {type:"parent", hair:"blond"}
	//	| var result = store.queryEngine(query)(cursor); 
	//
	
	// Requires JavaScript 1.8.5
	var StoreError = createError( "Cursor" );		// Create the CBTError type.
	var clone      = Lib.clone;									// HTML5 structure clone.
	var defProp    = Lib.defProp;
	var undef;

	function Cursor (/*Store|Index*/ source,/*KeyRange*/ range, /*String*/ direction,
										/*Boolean?*/ keyCursor) {
		// summary:
		//		Cursors are a transient mechanism used to iterate over multiple records
		//		in a store. Storage operations are performed on the underlying index
		//		object store.
		// source:
		//		The cursor's source, that is, store or index, on which this cursor will
		//		operate.
		// range:
		//		The key range to use as the cursor's range.
		// direction:
		//		The cursor's required direction.
		// keyCursor:
		//		Indicates if this is a key cursor. (default is false)
		// tag:
		//		Public

		//=========================================================================

		function assertSource(/*IDBIndex|IDBObjectStore*/ source ) {
			// summary:
			//		Test if the cursor's store or index is still in a valid state.
			// source:
			//		The index or store to assert.
			// exception:
			//		InvalidState
			// tag:
			//		Private
			if (source._destroyed || source._beingDestroyed) {
				throw new StoreError("InvalidState", "assertSource");
			}
			return true;
		}

		function loadCursor(source, keyRange, direction) {
			// summary:
			//		Load the cursor. This function is called once for each cursor.
			//		Effectively it returns the first record in range.
			// tag:
			//		Private
			var records = source._records;
			var range, keyLoc;

			range = Keys.getRange( source, keyRange );
			if (range.length) {
				var first = range.first;
				var last  = range.last;

				switch (direction) {
					case "next":
					case "nextunique":
						keyLoc = new Location( source, first-1, first, first+1 );
						break;
					case "prev":
						keyLoc = new Location( source, last-1, last, last+1 );
						if (index && !source.unique) {
							var storeKeys = keyLoc.record.value;
							keyLoc.position = storeKeys.length - 1;
						}
						break;
					case "prevunique":
						keyLoc = new Location( source, last-1, last, last+1 );
						break;
				}
			} else {
				// make sure keyLoc is a location object.
				keyLoc = new Location( source );
			}
			length = range.length;
			return keyLoc;
		}

		function iterateCursor(/*IDBCursor*/ cursor, /*any*/ key ) {
			// summary:
			//		Iterate the cursor
			// cursor:
			//		Cursor to iterate
			// tag:
			//		Private
			var position, record;

			if (locator) {
				switch (direction) {
					case "next":
						locator = locator.next(key);
						break;
					case "nextunique":
						locator = locator.next(key, true);
						break;
					case "prev":
						locator = locator.previous(key);
						break;
					case "prevunique":
						locator = locator.previous(key, true);
						break;
				}
			} else {
				locator = loadCursor(source, keyRange, direction);	
			}
			position = locator.position;
			record   = locator.record;

			if (record && Keys.inRange( record.key, keyRange)) {
				currentKey = primaryKey = record.key;
				if (index) {
					primaryKey = record.value[position];
					if (!keyCursor) {
						currentVal = store.get( primaryKey );
					}
				} else {
					currentVal = store._clone ? clone(record.value) : record.value;
				}
			} else {
				currentVal = currentKey = primaryKey = undefined;
				gotValue = false;
				return null;
			}
			gotValue = true;
			return cursor;
		}

		function advanceCursor(/*Cursor*/ cursor, /*any?*/ key,/*Number?*/ count ) {
			// summary:
			// tag:
			//		Private
			var result;
			
			if (assertSource( source )) {
				gotValue = false;
				do {
					result = iterateCursor( cursor, key );
				} while (--count > 0 && result);
			}
			return result;
		}

		//=========================================================================
		// Public Cursor methods.

		this.advance = function (/*number*/ count) {
			// summary:
			//		Advance the cursor count number of times forward.
			// count:
			//		The number of advances forward the cursor should make.
			// tag:
			//		Public
			if (gotValue) {
				if (count && (typeof count == "number" && count > 0)) {
					return !!advanceCursor(this, null, count);
				} else {
					throw new StoreError("DataError", "advance", "invalid count parameter" );
				}
			} else {
				throw new StoreError("InvalidState", "advance");
			}
		}

		// dojo buildsystem doesn't allow 'this.continue' therefore we use 'this.cont'
		this.cont = function (/*any?*/ key) {
			// summary:
			//		Advance the cursor once in the direction set for the cursor or to
			//		the key if specified.
			// key:
			//		The next key to position this cursor at
			// exception:
			//		DataError
			//		InvalidState
			// tag:
			//		Public
			if (key && !Keys.validKey(key)) {
				throw new StoreError("DataError", "cont");
			}
			if (gotValue) {
				return !!advanceCursor (this, key, 1);
			}
			throw new StoreError("InvalidState", "cont");
		}

		// dojo buildsystem doesn't allow 'this.delete' therefore we use 'this.remove'
		this.remove = function () {
			// summary:
			//		Delete the record with the cursor's current primary key from the store.
			// returns:
			//		A Boolean.
			// exception:
			//		InvalidState
			// tag:
			//		Public
			if (gotValue && !keyCursor) {
				if (store.remove( primaryKey )) {
					locator.last--;
					locator.gt--;
					length--;
					return true;
				}
				return false;
			}
			throw new StoreError("InvalidState", "remove");
		}

		this.update = function (/*object*/ value) {
			// summary:
			//		Update the value of the store record whose key matches the cursor's
			//		current primary key. If the updated value results in an different
			//		key for the record a StoreError of type DataError is thrown. This
			//		effectively means the caller is not allowed to change the primary
			//		key of the store record.
			// value:
			//		The new value to store.
			// exception:
			//		DataError
			//		InvalidState
			// tag:
			//		Public

			if (gotValue && !keyCursor) {
				if (value) {
					// Test if we need to supply the key or if it can be extracted from
					// the object. If the latter is the case make sure the primary did
					// not change.
					if (Keys.test( store, value ) && store.keyPath) {
						var keyValue = Keys.keyValue( store.keyPath, value );
						if (store.uppercase) {
							keyValue = Keys.toUpperCase( keyValue );
						}
						if (Keys.cmp(primaryKey, keyValue)) {
							throw new StoreError("DataError", "update", "primary key changed");
						}
						store.put( value, {overwrite:true} );
					} else {
						// Object has a generated or user defined key therefore re-use same key.
						store.put( value, {overwrite:true, key: primaryKey} );
					}
				}
			} else {
				throw new StoreError("InvalidState", "update");
			}
		}

		//=========================================================================
		// Array style properties/methods.

		this.forEach = function ( callback, thisArg ) {
			// summary:
			//		forEach executes the provided callback once for each element of the
			//		cursor. the callback is invoked with 3 arguments:
			//		1) the record value, 2) record index and 3) the cursor.
			// callback:
			// thisArg:
			//		The scope in which the callback will execute.
			// tag:
			//		Public, hidden
			if (typeof callback !== "function" ) {
				throw new StoreError("Parameter", "forEach", "%{0} is not a function", callback );
			}
			while (gotValue) {
				callback.call( thisArg, currentVal, locator.position, this );
				advanceCursor(this, null, 1);
			}
    };

		this.slice = function (begin, end) {
			// summary:
			//		Returns a shallow copy of a portion of a cursor
			// begin:
			//		Zero-based index at which to begin extraction. As a negative index,
			//		begin indicates an offset from the end of the sequence. slice(-2)
			//		extracts the second-to-last element and the last element in the
			//		sequence.
			// end:
			//		Zero-based index at which to end extraction. slice extracts up to
			//		but not including end.slice(1,4) extracts the second element through
			//		the fourth element (elements indexed 1, 2, and 3). As a negative
			//		index, end indicates an offset from the end of the sequence.
			// tag:
			//		Public, hidden

			if (!keyCursor) {
				var cursor = new Cursor( source, keyRange, direction, false );
				var count  = (end == undef) ? source.count( keyRange ) : Number(end);
				var values = [];
				
				while (cursor.value && count--) {
					values.push( cursor.value );
					cursor.cont();
				}
				return values.slice(begin,end);
			}
			throw new StoreError("NotSupported", "slice", "operation is not supported on a key cursor" );
		}

		defProp( this, "forEach", {enumerable: false});
		defProp( this, "slice", {enumerable: false});

		//=========================================================================

		var direction   = direction || "next";
		var source      = source;
		var store       = source;
		var gotValue    = false;
		var index       = false;
		var keyRange		= range;
		var length      = 0;

		var primaryKey;
		var currentKey;
		var currentVal;
		var locator;

		// Make properties read-only...
		defProp( this, "primaryKey", {get: function () { return primaryKey; },	enumerable: true});
		defProp( this, "direction", {get: function () { return direction; },	enumerable: true});
		defProp( this, "source", {get: function () { return source; }, enumerable: true});
		defProp( this, "key", {get: function () { return currentKey; },	enumerable: true});
		defProp( this, "length", {get: function () { return length; },	enumerable: true});

		// Implement IDBCursorWithValue
		if (!keyCursor) {
			defProp( this, "value", {get: function () { return currentVal; }, enumerable: true});
		}

		switch( source.type ) {
			case "index":
				store = source.store;
				index = true;
				break;
			case "store":
				break;
			default:
				throw new StoreError("NotSupported", "constructor", "Unknown source type" );
		}
		
		if (!Lib.isDirection(direction)) {
			throw new StoreError("InvalidType", "constructor", "Invalid cursor direction.");
		}

		if (!(keyRange instanceof KeyRange)) {
			if (keyRange != undef) {
				if (!Keys.validKey(keyRange)) {
					throw new StoreError( "TypeError", "constructor", "invalid keyRange");
				}
				keyRange = KeyRange.only( source.uppercase ? Keys.toUpperCase(keyRange) : keyRange );
			} else {
				keyRange = KeyRange.unbound();
			}
		}

		iterateCursor( this );		// Go load the cursor.

	}	/* end IDBCursor() */

	return Cursor;
});
