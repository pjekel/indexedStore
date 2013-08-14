//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License			(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/declare",
		"./_assert",
		"./_Procedures",
		"./Cursor",
		"./Keys",
		"./KeyRange",
		"./library",
		"./Location",
		"./opcodes",
		"./Record",
		"../dom/event/Event",
		"../error/createError!../error/StoreErrors.json"
	], function (declare, assert, _Procedures, Cursor, Keys, KeyRange, lib, Location, opcodes, Record,
				 Event, createError) {
	"use strict";
	// module:
	//		indexedStore/_base/_Indexed
	// summary:
	//		The _Indexed class arranges all object store records by key in ascending
	//		order. As a result, this type of store also support the use of cursors.
	//		For detailed information on cursors please refer to:
	//
	//			http://www.w3.org/TR/IndexedDB/#cursor-concept
	//
	// restrictions:
	//		Stores based on the _Indexed class do NOT support the Store.PutDirective
	//		'before'. If a natural record order is required by your application for
	//		example, you want to support 'before' with Drag-n-Drop, use the _Natural
	//		class instead.
	// NOTE:
	//		The _Indexed base class does NOT determine if a store can have an index
	//		or not, it merely determines the internal record structure, but because
	//		the records are structures in a binary tree the store itself can be used
	//		as an index.
	//
	// interface:
	//		_Indexed interface {
	//			void	_indexRecord();
	//			void	_removeFromIndex();
	//			Cursor	openCursor();
	//		};
	//		_Indexed implements _Procedures;
	//
	// example:
	//	|	require(["dojo/_base/declare",
	//	|	         "store/_base/_Store",
	//	|	         "store/_base/_Indexed",
	//	|	         "store/_base/_Loader!Advanced",
	//	|            "store/_base/KeyRange"
	//	|	        ], function (declare, _Store, _Indexed, _Loader, KeyRange) {
	//	|
	//	|	  var store = declare([_Store, _Indexed, Loader]);
	//	|	  var myStore = new store( {url:"../data/Simpsons.json", keyPath:"name"});
	//	|	                       ...
	//	|	  var range  = KeyRange.bound("Bart", "Homer");
	//	|	  var cursor = store.openCursor(range);
	//	|	  while (cursor && cursor.value) {
	//	|	    console.log( "Name: " + cursor.primaryKey);
	//	|	    cursor.next();
	//	|	  }
	//	|	});

	var StoreError = createError("Indexed");		// Create the StoreError type.
	var isObject   = lib.isObject;
	var clone      = lib.clone;						// HTML5 structured clone.
	var mixin      = lib.mixin;

	var C_MSG_MUTUAL_EXCLUSIVE = "base class '_Natural' and '_Indexed' are mutual exclusive";
	var C_MSG_CONSTRAINT_ERROR = "record with key [%{0}] already exist";
	var C_MSG_DEPENDENCY       = "base class '_Store' must be loaded first";

	var _Indexed = declare([_Procedures], {

		//===================================================================
		// Constructor

		constructor: function (kwArgs) {
			if (this.features.has("store")) {
				if (this.features.has("natural")) {
					throw new StoreError("Dependency", "constructor", C_MSG_MUTUAL_EXCLUSIVE);
				}
				// Mix in the appropriate directives...
				lib.defProp(this, "indexed", {value: true, writable: false, enumerable: true});
				this.features.add("indexed");
			} else {
				throw new StoreError("Dependency", "constructor", C_MSG_DEPENDENCY);
			}
		},

		//===================================================================
		// protected methods.

		_clearRecords: function () {
			// summary:
			//		Remove all records from the store and all indexes.
			// returns: Record[]
			//		An array of all deleted records
			// tag:
			//		protected
			var name, index, oldRecs = clone(this._records, false);
			for (name in this._indexes) {
				index = this._indexes[name];
				index._clear();
			}
			this._records.forEach(function (record) {
				record.destroy();
			});
			this._records = [];
			this.total = 0;
			return oldRecs;
		},

		//===================================================================
		// IndexedDB procedures

		_deleteKeyRange: function (key) {
			// summary:
			//		Remove all records from store whose key is in the key range.
			// key: Key|KeyRange
			//		Key identifying the record to be deleted. The key arguments can also
			//		be an KeyRange.
			// returns: Boolean
			//		true on successful completion otherwise false.
			// tag:
			//		protected

			if (!(key instanceof KeyRange)) {
				key = KeyRange.only(key);
			}
			var i, range = Keys.getRange(this, key);
			var deleted = false;
			if (range.record) {
				for (i = range.last; i >= range.first; i--) {
					deleted = this._deleteRecord(this._records[i], i);
				}
			}
			return !!deleted;
		},

		_deleteRecord: function (record, recNum) {
			// summary:
			//		Delete a single record from the store.
			// record: Record
			//		Record to be deleted
			// recNum: Number
			//		Record number (index).
			// returns: Boolean
			//		true on successful completion otherwise false.
			// tag:
			//		protected
			var event, key, tags, value;
			try {
				this._removeFromIndex(record);
				return true;
			} catch (err) {
				err   = StoreError.call(err, err, "_deleteRecord");
				event = new Event("error", {error: err, bubbles: true});
				this.dispatchEvent(event);
				throw err;
			} finally {
				// Make sure we destroy the real store record and not a clone.
				record = this._records.splice(recNum, 1)[0];
				value  = record.value;
				key    = record.key;
				tags   = record.tags;
				record.destroy();

				this.total = this._records.length;
				this.revision++;

				this._notify(opcodes.DELETE, key, null, value, recNum, null, tags);
			}
			return false;
		},

		_indexRecord: function (record) {
			// summary:
			//		Add the record to each store index. If any of the indexes throws an
			//		exception reverse the index operation and re-throw the error.
			// record: Record
			//		Record to index.
			// tag:
			//		protected
			var name, index;
			try {
				for (name in this._indexes) {
					index = this._indexes[name];
					index._add(record);
				}
			} catch (err) {
				// Failed to index the record, reverse operation and re-throw error.
				this._removeFromIndex(record);
				throw new StoreError(err, "_indexRecord");
			}
		},

		_retrieveRecord: function (key) {
			// summary:
			//		Retrieve the first record from the store whose key matches key and
			//		return a Locator object if found.
			// key: Key|KeyRange
			//		Key identifying the record to be retrieved. The key arguments can also
			//		be an KeyRange.
			// returns: Location
			//		A Location object. (see the Location module for details).
			// tag:
			//		protected
			if (key instanceof KeyRange) {
				var range = Keys.getRange(this, key);
				var first = range.first;
				if (range.record) {
					return new Location(this, first - 1, first, first + 1);
				}
				return new Location(this);
			}
			return Keys.search(this, key);
		},

		_removeFromIndex: function (record) {
			// summary:
			//		Remove a record from all indexes including the local index.
			// record: Record
			//		Record to be removed.
			// tag:
			//		protected
			var name, index;
			try {
				for (name in this._indexes) {
					index = this._indexes[name];
					index._remove(record);
				}
			} catch (err) {
				throw new StoreError(err, "_removeFromIndex");
			}
		},

		_storeRecord: function (value, options, tags) {
			// summary:
			//		Add a record to the store. Throws an exception of type ConstraintError
			//		if the key already exists and overwrite flag is set to false.
			// NOTE:
			//		Indexed stores do not include location information in events as the
			//		record location is not related to any natural order.
			// value: Any
			//		Record value property (the object)
			// options: Store.PutDirectives
			//		Optional, PutDirectives
			// tags: Object?
			//		Optional set of properties to be stored with the record.
			// returns:
			//		Record key.
			// tag:
			//		protected
			var curRev, curTag, curVal, event, opType, optKey, newVal, newRec;
			var cloned  = this._clone, overwrite = false;
			var records = this._records;

			if (options) {
				overwrite = !!options.overwrite;
				optKey    = options.key != null ? options.key : (options.id != null ? options.id : null);
				cloned    = options.clone !== undefined ? !!options.clone : cloned;
			}
			// Extract key value and test if the primary key already exists.
			try {
				var keyVal = Keys.getKey(this, value, optKey, this.uppercase);
				// Try to locate the record.
				var curLoc = this._retrieveRecord(keyVal);
				var curRec = curLoc.record;
				var curAt  = curLoc.eq;

				if (curRec) {
					if (!overwrite) {
						var err = new Error("object with key [" + keyVal + "] already exists");
						err.name = "ConstraintError";
						throw err;
					}
					opType = opcodes.UPDATE;
					curRev = curRec.tags.rev;
					curTag = curRec.tags;
					curVal = curRec.value;

					this._removeFromIndex(curRec);
				} else {
					if (this.defaultProperties) {
						this._applyDefaults(value);
					}
					opType = opcodes.NEW;
					curRev = 0;
				}
				tags   = mixin(curTag, tags, {rev: curRev + 1});
				newVal = cloned ? clone(value) : value;
				newRec = new Record(keyVal, newVal, clone(tags));

				// Index the record first in case an error occurs.
				this._indexRecord(newRec);
				if (curRec) {
					records[curAt] = newRec;
				} else {
					records.splice(curLoc.gt, 0, newRec);
					curAt = curLoc.gt;
				}
				this.total = records.length;
				this.revision++;

				this._notify(opType, keyVal, value, curVal, curAt, options, tags);
				return keyVal;
			} catch (err) {
				// In case of an exception dispatch an error event at the store.
				err   = StoreError.call(err, err, "_storeRecord");
				event = new Event("error", {error: err, bubbles: true});
				this.dispatchEvent(event);
				throw err;
			}
		},

		//=========================================================================
		// Public IndexedStore/api/store API methods

		openCursor: function (keyRange, direction) {
			// summary:
			//		Open a new cursor. A cursor is a transient mechanism used to iterate
			//		over multiple records in the store.  A cursor does NOT contain any
			//		store data and therefore does NOT have a length property like a Range
			//		object does.
			// keyRange: Key|KeyRange?
			//		The key range to use as the cursor's range.
			// direction: DOMString?
			//		The cursor's required direction: 'next', 'nextunique', 'prev' or
			//		'prevunique'. Default is 'next'.
			// returns:
			//		A cursorWithValue object.
			// example:
			//	| var cursor = store.openCursor();
			//	| while(cursor && cursor.value) {
			//	|       ...
			//	|     cursor.next();
			//	| };
			// tag:
			//		Public
			assert.store(this, "openCursor");
			assert.key(keyRange, "openCursor");

			var dir = direction || "next";
			if (!lib.isDirection(dir)) {
				throw new StoreError("DataError", "openCursor");
			}
			var cursor = new Cursor(this, keyRange, dir, false);
			return cursor;
		}
	});	/* end declare() */
	return _Indexed;
});
