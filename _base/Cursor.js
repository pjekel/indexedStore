//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//  The IndexedStore is released under to following two licenses:
//
//  1 - The "New" BSD License       (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//  2 - The Academic Free License   (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["./Keys",
		"./KeyRange",
		"./library",
		"./Location",
		"../error/createError!../error/StoreErrors.json"
	], function (Keys, KeyRange, lib, Location, createError) {
	"use strict";

	// module:
	//		indexedStore/_base/Cursor
	// summary:
	//		Cursors are a transient mechanism used to iterate over multiple records
	//		in a store. Storage operations are performed on the underlying index or
	//		object store. This module implements the IDBCursor interface:
	//
	//			http://www.w3.org/TR/IndexedDB/#cursor
	//
	//		Cursors are supported on indexedStore/_base/_Indexed based stores and
	//		all indexes.
	//
	// NOTE:
	//		The dojo build system does not allow the use of the reserved keywords
	//		'continue' and 'delete' as object properties therefore the following
	//		alternatives are used:
	//
	//				IndexedDB           indexedStore/_base/Cursor
	//
	//			cursor.continue()   -->     cursor.next()
	//			cursor.delete()     -->     cursor.remove()

	var StoreError = createError("Cursor");		// Create the CBTError type.
	var defProp    = lib.defProp;
	var clone      = lib.clone;					// HTML5 structure clone.

	function Cursor(source, range, direction, keyCursor) {
		// summary:
		//		Cursors are a transient mechanism used to iterate over multiple records
		//		in a store. Storage operations are performed on the underlying index
		//		object store.
		// source: Store|Index
		//		The cursor's source, that is, store or index, on which this cursor will
		//		operate.
		// range: KeyRange?
		//		The key range to use as the cursor's range.
		// direction: String?
		//		The cursor's required direction, default is "next"
		// keyCursor: Boolean?
		//		Indicates if this is a key cursor. (default is false)
		// returns: Cursor
		//		A new Cursor object
		// tag:
		//		Public

		var currentKey, currentVal, locator, primaryKey;
		var dirUnique  = false;
		var dirForward = true;
		var gotValue   = false;
		var index      = false;
		var keyRange   = range;
		var store      = null;

		//=========================================================================

		function assertSource(source) {
			// summary:
			//		Test if the cursor's store or index is still in a valid state.
			// source: Store|Index
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

		function advanceCursor(cursor, key, count) {
			// summary:
			//		Advance the cursor 'count' number of times in the cursor direction.
			// cursor: Cursor
			// key: Key?
			// count: Number?
			// tag:
			//		Private
			var result;

			if (assertSource(source)) {
				gotValue = false;
				do {
					result = iterateCursor(cursor, key);
				} while (--count > 0 && result);
			}
			return result;
		}

		function iterateCursor(cursor, key) {
			// summary:
			//		Perform one cursor iteration
			// cursor: Cursor
			//		Cursor to iterate
			// key: Key?
			//		The next key to position this cursor at
			// tag:
			//		Private
			var record, range, reset = false;
			if (!locator) {
				// Create a location object and get the first key in range.
				locator = new Location(source);
				range = Keys.getRange(source, keyRange);
				if (range.total) {
					record = dirForward ? source._records[range.first] : source._records[range.last];
					key = record.key;
				} else {
					gotValue = false;
					return null;
				}
				reset = true;		// reset the locator.
			}

			if (dirForward) {
				locator = next(key, dirUnique, reset);
			} else {
				locator = previous(key, dirUnique, reset);
			}
			record = locator.record;

			if (record && Keys.inRange(record.key, keyRange)) {
				if (index && !keyCursor) {
					currentVal = store.get(primaryKey);
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

		function nextRefKey(key, list, next) {
			// summary:
			//		Get the next store reference key that shares the same index
			//		key. This function is only called on indexes with duplicate
			//		keys.
			// key: Key
			//		The current primary key.
			// list: Key[]
			//		List of store keys who all share the same index key. The list
			//		is always sorted in ascending order.
			// next: Boolean
			//		If true search list in the forward direction otherwise search
			//		backwards
			// tag:
			//		private
			var keyIdx = Keys.indexOf(list, key);
			var length = list.length;
			var nxtIdx = next ? 0 : length - 1;

			// If the keyIdx equals -1 the primary key, set in the last iteration,
			// has been deleted.
			if (keyIdx == -1) {
				if (next) {
					while (nxtIdx < length && Keys.cmp(key, list[nxtIdx]) > 0) {
						nxtIdx++;
					}
				} else {
					while (nxtIdx >= 0 && Keys.cmp(key, list[nxtIdx]) < 0) {
						nxtIdx--;
					}
				}
			} else {
				nxtIdx = next ? keyIdx + 1 : keyIdx - 1;
			}
			return nxtIdx;
		}

		function setKeys(key, primKey) {
			// summary:
			//		Update the current and primary key.
			// key:
			// primKey:
			// tag:
			//		Private
			currentKey = key;
			primaryKey = primKey;
		}

		function next(key, unique, reset) {
			// summary:
			//		Get the next record relative to the current location.
			// key: Key?
			//		The next key to position this cursor at.
			// unique: Boolean
			//		If true records with duplicate keys are skipped.
			// reset: Boolean?
			// returns: Location
			//		A location object.
			// tag:
			//		Private
			var keyIdx, keyLoc, keyLst, record;
			var nxtLoc = locator.gt;

			if (key != null) {
				// Move cursor to a specific key location.
				keyLoc = Keys.search(source, key);
				keyIdx = keyLoc.eq != -1 ? keyLoc.eq : keyLoc.ls + 1;
				if (!reset && keyIdx < nxtLoc) {
					return new Location(source, -1, -1, 0);
				}
				nxtLoc = keyIdx;
			} else {
				record = source._records[locator.eq];
				// Test if the current record still exist and hasn't changed....
				if (record && !Keys.cmp(record.key, currentKey)) {
					if (!unique && (index && !source.unique)) {
						keyLst = record.value;
						keyIdx = nextRefKey(primaryKey, keyLst, true);
						if (keyIdx < keyLst.length) {
							setKeys(record.key, keyLst[keyIdx]);
							return locator;
						}
					}
				} else {
					// The record identified by the location object has been deleted.
					return next(currentKey, unique, true);
				}
			}
			if (nxtLoc >= 0 && nxtLoc < source._records.length) {
				keyLoc = new Location(source, nxtLoc - 1, nxtLoc, nxtLoc + 1);
				setKeys(keyLoc.key, index ? keyLoc.value[0] : keyLoc.key);
				return keyLoc;
			}
			return new Location(source, nxtLoc - 1, -1, nxtLoc);
		}

		function previous(key, unique, reset) {
			// summary:
			//		Get the previous record relative to the current location.
			// key: Key?
			//		The next key to position this cursor at.
			// unique: Boolean?
			//		If true no records with duplicate keys are returned.
			// reset: Boolean?
			// returns: Location
			//		A location object.
			// tag:
			//		Private
			var keyIdx, keyLst, keyLoc, record;
			var nxtLoc = locator.ls;

			if (key != null) {
				// Move cursor to a specific key location.
				keyLoc = Keys.search(source, key);
				keyIdx = keyLoc.eq != -1 ? keyLoc.eq : keyLoc.gt - 1;
				if (!reset && keyIdx > nxtLoc) {
					return new Location(source, -1, -1, 0);
				}
				nxtLoc = keyIdx;
			} else {
				record = source._records[locator.eq];
				if (record && !Keys.cmp(record.key, currentKey)) {
					if (!unique && (index && !source.unique)) {
						keyLst = record.value;
						keyIdx = nextRefKey(primaryKey, keyLst, false);
						if (keyIdx >= 0) {
							setKeys(record.key, keyLst[keyIdx]);
							return locator;
						}
					}
				} else {
					// The record identified by the location object has been deleted.
					return previous(currentKey, unique, true);
				}
			}
			nxtLoc = Math.min(nxtLoc, source._records.length - 1);
			if (nxtLoc >= 0) {
				keyLoc = new Location(source, nxtLoc - 1, nxtLoc, nxtLoc + 1);
				if (index) {
					if (unique) {
						setKeys(keyLoc.key, keyLoc.value[0]);
					} else {
						setKeys(keyLoc.key, keyLoc.value[keyLoc.value.length - 1]);
					}
				} else {
					setKeys(keyLoc.key, keyLoc.key);
				}
				return keyLoc;
			}
			return new Location(source, nxtLoc - 1, -1, nxtLoc);
		}

		//=========================================================================
		// Public Cursor methods.

		this.advance = function (count) {
			// summary:
			//		Advance the cursor count number of times forward in the direction
			//		set for the cursor.
			// count: Number
			//		The number of advances forward the cursor should make.
			// tag:
			//		Public
			if (!gotValue) {
				throw new StoreError("InvalidState", "advance");
			}
			if (count && (typeof count != "number" || count < 0)) {
				throw new StoreError("DataError", "advance", "invalid count parameter");
			}
			return !!advanceCursor(this, null, count);
		};

		// dojo build system doesn't allow 'this.continue' therefore we use 'this.next'

		// this.continue = function (key) {
		this.next = function (key) {
			// summary:
			//		Advance the cursor once in the direction set for the cursor or to
			//		the key if specified.
			// key: Key?
			//		The next key to position this cursor at
			// returns: Boolean
			//		True if the cursor was successfully repositioned otherwise false.
			// tag:
			//		Public
			if (key && !Keys.validKey(key)) {
				throw new StoreError("DataError", "cont");
			}
			if (gotValue) {
				return !!advanceCursor(this, key, 1);
			}
			throw new StoreError("InvalidState", "cont");
		};

		// dojo build system doesn't allow 'this.delete' therefore we use 'this.remove'

		//this.delete = function () {
		this.remove = function () {
			// summary:
			//		Delete the record with the cursor's current primary key from the store.
			// returns: Boolean
			//		True if the object at the current cursor position was successfully
			//		removed otherwise false.
			// tag:
			//		Public
			if (gotValue && !keyCursor) {
				if (store.remove(primaryKey)) {
					return true;
				}
				return false;
			}
			throw new StoreError("InvalidState", "remove");
		};

		this.update = function (value) {
			// summary:
			//		Update the value of the store record whose key matches the cursor's
			//		current primary key. If the updated value results in an different
			//		key for the record a StoreError of type DataError is thrown. This
			//		effectively means the caller is not allowed to change the primary
			//		key of the store record.
			// value: Object
			//		The new value to store.
			// tag:
			//		Public
			var keyValue;

			if (gotValue && !keyCursor) {
				if (value) {
					// Test if we need to supply the key or if it can be extracted from
					// the object. If the latter is the case make sure the primary did
					// not change.
					if (Keys.test(store, value) && store.keyPath) {
						keyValue = Keys.keyValue(store.keyPath, value, store.uppercase);
						if (Keys.cmp(primaryKey, keyValue)) {
							throw new StoreError("DataError", "update", "primary key changed");
						}
						store.put(value, {overwrite: true});
					} else {
						// Object has a generated or user defined key therefore re-use same key.
						store.put(value, {overwrite: true, key: primaryKey});
					}
				}
			} else {
				throw new StoreError("InvalidState", "update");
			}
		};

		//=========================================================================
		direction  = direction || "next";

		if (source) {
			switch (source.type) {
				case "index":
					store = source.store;
					index = true;
					break;
				case "store":
					store = source;
					break;
				default:
					throw new StoreError("NotSupported", "constructor", "Unknown source type");
			}
		} else {
			throw new StoreError("DataError", "constructor", "source argument missing");
		}

		if (lib.isDirection(direction)) {
			dirForward = /^next/.test(direction);
			dirUnique  = /unique$/.test(direction);
		} else {
			throw new StoreError("InvalidType", "constructor", "Invalid cursor direction.");
		}

		if (!(keyRange instanceof KeyRange)) {
			if (keyRange != null) {
				if (!Keys.validKey(keyRange)) {
					throw new StoreError("TypeError", "constructor", "invalid keyRange");
				}
				keyRange = KeyRange.only(keyRange);
			}
		}
		// Define read-only properties
		defProp(this, "primaryKey", {get: function () { return primaryKey; }, enumerable: true});
		defProp(this, "direction", {get: function () { return direction; }, enumerable: true});
		defProp(this, "source", {get: function () { return source; }, enumerable: true});
		defProp(this, "key", {get: function () { return currentKey; }, enumerable: true});
		// Implement IDBCursorWithValue
		if (!keyCursor) {
			defProp(this, "value", {get: function () { return currentVal; }, enumerable: true});
		}
		iterateCursor(this);		// Go load the cursor.
	}	/* end IDBCursor() */
	return Cursor;
});
