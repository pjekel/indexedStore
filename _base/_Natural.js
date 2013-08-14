//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/declare",
		"./_Procedures",
		"./Keys",
		"./KeyRange",
		"./library",
		"./Location",
		"./opcodes",
		"./Record",
		"../dom/event/Event",
		"../error/createError!../error/StoreErrors.json"
	], function (declare, _Procedures, Keys, KeyRange, lib, Location, opcodes, Record,
	             Event, createError) {
	"use strict";

	// module:
	//		IndexedStore/_base/_Natural
	// summary:
	//		The _Natural class arranges all object store records in a natural order.
	//		The natural order is the order in which records are added to the store
	//		and/or re-arranged using the Store.PutDirective property 'before'.
	//		Natural based stores also maintain a record number based index for fast
	//		retrieval of records however this type of index is not suitable for the
	//		use with cursors or any other IndexedDB based key operations.
	//		To insert an object before another store object one would typically
	//		perform an operation like:
	//
	//			store.put( {name:"Bart", lastname:"Simpson"}, {before:"Lisa"});
	//
	//		Notice that the 'before' property value can be either an object or a
	//		valid store key.
	//
	// interface:
	//		_Natural interface {
	//			sequence<Number|Record>	_getInRange();
	//			void					_indexRecord();
	//			void					_reindex();
	//			void					_removeFromIndex();
	//		};
	//		_Natural implements _Procedures;
	//
	// restrictions:
	//		Stores based on the _Natural class do NOT support cursors therefore an
	//		operation like store.openCursor() is not available.  However, you can
	//		still use cursors on an index associated with the store to achieve the
	//		same effect. For example:
	//
	//	|	require(["dojo/_base/declare",
	//	|	         "store/_base/_Store",
	//	|	         "store/_base/_Natural",
	//	|	         "store/_base/_Loader!Advanced",
	//	|	         "store/_base/KeyRange"
	//	|	        ], function (declare, _Store, _Natural, _Loader, KeyRange) {
	//	|
	//	|	  var store = declare([ _Store, _Natural, _Loader]);
	//	|	  var myStore = new store({url:"../data/Simpsons.json", keyPath:"name"});
	//	|	                       ...
	//	|	  var index  = store.createIndex("names", "name", {unique:true});
	//	|	  var range  = KeyRange.bound("Bart", "Homer");
	//	|	  var cursor = index.openCursor(range);
	//	|	  while (cursor && cursor.value) {
	//	|	    console.log("Name: " + cursor.primaryKey);
	//	|	    cursor.next();
	//	|	  }
	//	|	});
	//
	// NOTE:
	//		The _Natural base class does NOT determine if a store can have an index
	//		or not, it merely determines the internal record structure. Indexes are
	//		handled separate from the internal record structure.
	//		Although _Natural based stores do support key ranges with certain store
	//		operations, the use of them is not recommended on large datasets.

	var StoreError = createError("_Natural");			// Create the StoreError type.
	var isObject   = lib.isObject;
	var clone      = lib.clone;							// HTML5 structured clone.
	var mixin      = lib.mixin;
	var move       = lib.move;

	var C_MSG_MUTUAL_EXCLUSIVE = "base class '_Natural' and '_Indexed' are mutual exclusive";
	var C_MSG_CONSTRAINT_ERROR = "record with key [%{0}] already exist";
	var C_MSG_DEPENDENCY       = "base class '_Store' must be loaded first";

	var _Natural = declare([_Procedures], {

		//===================================================================
		// Constructor

		constructor: function (kwArgs) {
			if (this.features.has("store")) {
				if (this.features.has("indexed")) {
					throw new StoreError("Dependency", "constructor", C_MSG_MUTUAL_EXCLUSIVE);
				}
				this._index = {};			// Local record index.

				// Mix in the appropriate directives...
				lib.defProp(this, "natural", {value: true, writable: false, enumerable: true});
				this.features.add("natural");
			} else {
				throw new StoreError("Dependency", "constructor", C_MSG_DEPENDENCY);
			}
		},

		//===================================================================
		// protected methods.

		_clearRecords: function () {
			// summary:
			//		Remove all records from the store and all indexes.
			// returns: Records[]
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
			this._index   = {};
			this.total    = 0;
			return oldRecs;
		},

		//===================================================================
		// IndexedDB procedures

		_deleteKeyRange: function (key) {
			// summary:
			//		Remove all records from store whose key is in the key range.
			// key: KeyRange|Key
			//		Key identifying the record to be deleted. The key arguments can
			//		also be an KeyRange.
			// returns: Boolean
			//		true on successful completion otherwise false.
			// tag:
			//		protected
			var deleted = false;

			if (key instanceof KeyRange) {
				var record, range = this._getInRange(key, true);
				if (range.length) {
					// Sort the record numbers in descending order.
					range = range.sort(function (a, b) {return b - a; });
					range.forEach(function (index) {
						record = this._records[index];
						this._deleteRecord(record, index);
						deleted = true;
					}, this);
				}
			} else {
				var loc = this._retrieveRecord(key);
				if (loc.record) {
					deleted = this._deleteRecord(loc.record, loc.eq);
				}
			}
			if (deleted) {
				this._reindex();
			}
			return deleted;
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
			var key, tags, value;
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

		_getInRange: function (keyRange, indexOnly) {
			// summary:
			//		Get all records, or their index number, within the given key
			//		range. The resulting array is in record order as apposed to
			//		index order.
			// keyRange: KeyRange
			//		Instance of KeyRange
			// indexOnly: Boolean?
			//		If true, the result returned will be an array of index number
			//		otherwise an array of records
			// returns: (Number|Record)[]
			//		Depending on indexOnly an array of records or record numbers.
			// tag:
			//		protected
			var records = this._records;
			var max     = records.length;
			var i, results = [];

			if (keyRange) {
				if (keyRange.lower && keyRange.upper && !Keys.cmp(keyRange.lower, keyRange.upper)) {
					// if key is a KeyRange.only() simply fetch the record.
					var loc = this._retrieveRecord(keyRange.lower);
					if (loc.record) {
						results.push(indexOnly ? loc.eq : loc.record);
					}
				} else {
					for (i = 0; i < max; i++) {
						if (Keys.inRange(records[i].key, keyRange)) {
							results.push(indexOnly ? i : records[i]);
						}
					}
				}
			} else {
				if (indexOnly) {
					// Generate a NUMERIC array, therefor no Object.keys()
					for (i = 0; i < max; i++) {
						results.push(i);
					}
				} else {
					results = records.slice();
				}
			}
			return results;
		},

		_indexRecord: function (record, recNum) {
			// summary:
			//		Add the record to each store index. If any of the indexes throws an
			//		exception reverse the index operation and re-throw the error.
			// record: Record
			//		Record to index.
			// recNum: Number
			//		Record number
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
				for (name in this._indexes) {
					index = this._indexes[name];
					index._remove(record);
				}
				throw new StoreError(err, "_indexRecord");
			}
			this._index[record.key] = recNum;
		},

		_reindex: function () {
			// summary:
			//		Re-index all store records. This function is called when either a
			//		record is deleted or moved.
			// tag:
			//		protected
			var rec, i, max = this._records.length;
			this._index = {};			// Drop local index.
			for (i = 0; i < max; i++) {
				rec = this._records[i];
				this._index[rec.key] = i;
			}
			this.total = max;
		},

		_retrieveRecord: function (key) {
			// summary:
			//		Retrieve the first record from the store whose key matches key and
			//		return a locator object if found.
			// key: Key|KeyRange
			//		Key identifying the record to be retrieved. The key arguments can
			//		also be an KeyRange.
			// returns: Location
			//		A Location object. (see the Location module for detais).
			// tag:
			//		protected
			if (key != null) {
				var recNum, record;
				if (key instanceof KeyRange) {
					recNum = this._getInRange(key, true)[0];
					if (recNum !== undefined) {
						return new Location(this, recNum - 1, recNum, recNum + 1);
					}
				} else {
					recNum = this._index[key];
					record = this._records[recNum];
					// Make sure we distinguish between string and numeric key values
					// (e.g 100 vs "100") by comparing the key and record key.
					if (record && !Keys.cmp(key, record.key)) {
						return new Location(this, recNum - 1, recNum, recNum + 1);
					}
				}
			}
			return new Location(this, this._records.length - 1, -1, this._records.length);
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
			} finally {
				delete this._index[record.key];
			}
		},

		_storeRecord: function (value, options, tags) {
			// summary:
			//		Add a record to the store. Throws a StoreError of type ConstraintError
			//		if the key already exists and noOverwrite is set to true.
			// value: Any
			//		Record value property
			// options: PutDirectives
			//		Optional, PutDirectives
			// tags: Object?
			//		Optional set of properties to be stored with the record.
			// returns: Key
			//		Record key.
			// tag:
			//		protected
			var at, before, curRev, curTag, curVal, event, newRec, newVal, opType, optKey;
			var cloned  = this._clone, overwrite = false;
			var records = this._records;

			if (options) {
				overwrite = !!options.overwrite;
				optKey    = options.key != null ? options.key : (options.id != null ? options.id : null);
				cloned    = options.clone !== undefined ? !!options.clone : cloned;
				before    = options.before || null;

				if (before) {
					if (isObject(before)) {
						before = this.getIdentity(before);
					}
					before = this._retrieveRecord(before);
				}
			}
			try {
				// Extract key value and test if the primary key already exists.
				var keyVal = Keys.getKey(this, value, optKey, this.uppercase);
				// Try to locate the record.
				var curLoc  = this._retrieveRecord(keyVal);
				var curRec  = curLoc.record;
				var curAt   = curLoc.eq;

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

				if (before && before.record) {
					move(records, curAt, before.eq, newRec);
					this._indexRecord(newRec, before.eq);
					this._reindex();
					at = before.eq;
				} else {
					at = curRec ? curAt : records.length;
					if (curRec) {
						records[at] = newRec;
					} else {
						records.push(newRec);
					}
					this._indexRecord(newRec, at);
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
		}

	});	/* end declare() */

	return _Natural;

});
