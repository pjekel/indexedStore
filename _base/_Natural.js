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
				"dojo/_base/lang",
				"dojo/store/util/QueryResults",
				"./Keys",
				"./KeyRange",
				"./Library",
				"./Location",
				"./Record",
				"../error/createError!../error/StoreErrors.json",
				"../dom/event/Event"
			 ], function (declare, lang, QueryResults, Keys, KeyRange, Lib, Location, 
										 Record, createError, Event) {
	"use strict";
	// module:
	//		IndexedStore/_base/_Natural
	// summary:
	// 		The _Natural class is used in combination with the store/_base/_Store
	//		class and will organize all object store records in a natural order.
	//		The natural order is the order in which records are added to the store
	//		and/or re-arranged using the PutDirective property 'before'.
	//		Natural based stores also maintain a record number based index for fast
	//		retrieval of records however this type of index is not suitable for the
	//		use with cursors or any other IndexedDB based key operations.
	//		To insert an object before another store object one would typically
	//		perform an operation like:
	//
	//			store.put( {name:"Bart", lastname:"Simpson"}, {before:"Lisa"});
	//
	//		Notice that the 'before' property can be either an object or a valid
	//		store key.
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
	//	|	         "store/_base/KeyRange",
	//	|	         "store/extension/Loader"
	//	|	        ], function (declare, _Store, _Natural, KeyRange, Loader) {
	//	|
	//	|	  var store = declare([_Store, _Natural, Loader]);
	//	|	  var myStore = new store( {url:"../data/Simpsons.json", keyPath:"name"} );
	//	|	                       ...
	//	|   var index  = store.createIndex("names", "name", {unique:true});
	//	|	  var range  = KeyRange.bound("Bart", "Homer");
	//	|	  var cursor = index.openCursor(range);
	//	|	  while (cursor && cursor.value) {
	//	|	    console.log( "Name: " + cursor.primaryKey );
	//	|	    cursor.continue();
	//	|	  } 
	//	|	});
	//
	// NOTE:
	//		The _Natural base class does NOT determine if a store can have an index
	//		or not, it merely determines the internal record structure. Indexes are
	//		handled separate from the internal record structure.
	//		Although _Natural based stores do support key ranges with certain store
	//		operations, the use of them is not recommended on large datasets.

	var StoreError = createError( "_Natural" );			// Create the StoreError type.
	var isObject   = Lib.isObject;
	var clone      = Lib.clone;											// HTML5 structured clone.
	var undef;
	
	var _Natural = {

		//===================================================================
		// Constructor

		constructor: function () {
			if (this.features.has("store")) {
				if (this.features.has("indexed")) {
					throw new StoreError("Dependency", "constructor", "base class '_Natural' and '_Indexed' are mutual exclusive");
				}
				this._index      = {};			// Local record index.

				this.features.add("natural");
				Lib.defProp( this,"natural", {value:true, writable:false, enumerable:true} );
				Lib.protect(this);
			} else {
				throw new StoreError("Dependency", "constructor", "base class '_Store' must be loaded first");
			}
		},

		//===================================================================
		// Private methods.

		_clearRecords: function () {
			// summary:
			//		Remove all records from the store and all indexes.
			// tag:
			//		Private
			var name, index;
			for(name in this._indexes) {
				index = this._indexes[name];
				index._clear();
			}
			this._records.forEach( function (record) {				
				record.destroy();
			});
			this._records = [];
			this._index   = {};
			this.total = 0;
		},

		//===================================================================
		// IndexedDB procedures

		_deleteKeyRange: function (/*KeyRange|Key*/ key ) {
			// summary:
			//		Remove all records from store whose key is in the key range.
			// key:
			//		Key identifying the record to be deleted. The key arguments can also
			//		be an KeyRange.
			// returns:
			//		true on successful completion otherwise false.
			// tag:
			//		Private

			var deleted = false;
			var record;
			
			if( !(key instanceof KeyRange)) {
				var locator = this._retrieveRecord(key);
				if (locator.record) {
					deleted = this._deleteRecord( locator.record, locator.eq );
				}
			} else {
				var range = this._getInRange(key);
				if (range.length) {
					// Sort the record numbers in descending order.
					range = range.sort( function (a,b) {return b-a;} );
					range.forEach( function (index) {
						record = this._records[index];
						this._deleteRecord( record, index );
						deleted = true;

					}, this );
				}
			}
			if (deleted) {
				this._reindex();
			}
			return deleted;
		},

		_deleteRecord: function (/*Record*/ record, /*Number*/ recNum ) {
			// summary:
			//		Delete a single record from the store.
			// record:
			//		Record to be deleted
			// recNum:
			//		Record number (index).
			// tag:
			//		Private

			try {
				this._removeFromIndex(record);
				return true;
			} catch (err) {
				throw new StoreError( err, "_deleteRecord" );
			} finally {
				// Make sure we destroy the real store record and not a clone.
				var record = this._records.splice( recNum, 1 )[0];
				var value  = record.value;
				var key    = record.key;
				record.destroy();

				this.total = this._records.length;
				this.revision++;
				
				this._callbacks.fireWithOptions("delete", key, null, value, recNum );

				if (!this.suppressEvents) {
					var event  = new Event("delete", {detail:{item: value, at:-1, from:recNum}});
					this.dispatchEvent(event);
				}
			}
			return false;
		},

		_getInRange: function (/*KeyRange*/ keyRange) {
			// summary:
			//		Get the record numbers of all records within the key range. 
			//		Note: on large datasets this can be expensive in terms of
			//		performance.
			// keyRange:
			//		Instance of KeyRange
			// returns:
			//		An array of record numbers.
			// tag:
			//		Private
			var recIdx = [], idxKey, keyVal, recNum;
			if (keyRange instanceof KeyRange) {
				for (idxKey in this._index) {
					// Get the real key, which may be numeric, from the record.
					recNum = this._index[idxKey];
					keyVal = this._records[recNum].key;
					if (Keys.inRange( keyVal, keyRange )) {
						recIdx.push(recNum);
					}
				}
			}
			return recIdx;
		},

		_indexRecord: function (/*Record*/ record,/*Number*/ recNum) {
			// summary:
			//		Add the record to each store index. If any of the indexes throws an
			//		exception reverse the index operation and re-throw the error.
			// record:
			//		Record to index.
			// exceptions:
			// tag:
			//		Private
			var name, index;
			try {
				for(name in this._indexes) {
					index = this._indexes[name];
					index._add( record );
				}
			} catch (err) {
				// Failed to index the record, reverse operation and re-throw error.
				for(name in this._indexes) {
					index = this._indexes[name];
					index._remove( record );
				}
				throw new StoreError(err, "_indexRecord");
			}
			this._index[record.key] = recNum;
		},

		_moveRecord: function (/*Record*/ record,/*Number*/ from,/*Number*/ to) {
			// summary:
			//		Move a record within the natural order of the store.
			// record:
			//		Record to be moved.
			// from:
			//		Current record location
			// to:
			//		New record location
			// tag:
			//		Private
			this._records.splice( to, 0, record );
			if (from != -1) {
				this._records.splice( (to <= from ? from+1 : from), 1);
			}
			this._indexRecord(record, to);
			this._reindex();
		},

		_reindex: function () {
			// summary:
			//		Re-index all store records. This function is called when either a
			//		record is deleted or moved.
			// tag:
			//		Private
			var max = this._records.length;
			var rec, i;

			this._index = {};			// Drop local index.
			for (i=0; i<max; i++) {
				rec = this._records[i];
				this._index[rec.key] = i;
			}
			this.total = max;
		},

		_retrieveRecord: function (/*any*/ key ) {
			// summary:
			//		Retrieve the first record from the store whose key matches key and
			//		return a locator object if found.
			// key:
			//		Key identifying the record to be retrieved. The key arguments can also
			//		be an KeyRange.
			// returns:
			//		A location object. (see the ./_base/Location module for detais).
			// tag:
			//		Private
			var recNum, max = this._records.length;

			if (key != undef) {
				if (key instanceof KeyRange) {
					recNum = this._getInRange(key)[0];
					if (recNum == undef) {
						return new Location( this, max-1, -1, max );
					}
				} else {
					key = this.uppercase ? Keys.toUpperCase(key) : key;
					recNum = this._index[key];
					if (recNum == undef) {
						return new Location( this, max-1, -1, max );
					}
					// Make sure we distinguish between string and numeric keys values
					// (e.g 100 vs "100")
					var record = this._records[recNum];
					if (typeof key != typeof record.key) {
						return new Location( this, max-1, -1, max );
					}
				}
				return new Location( this, recNum-1, recNum, this._records.length );
			}
			return new Location( this, max-1, -1, max );
		},

		_removeFromIndex: function (/*Record*/ record) {
			// summary:
			//		Remove a record from all indexes including the local index.
			// record:
			//		Record to be removed.
			// tag:
			//		Private
			var name, index;
			try {
				for(name in this._indexes) {
					index = this._indexes[name];
					index._remove( record );
				}
			} catch (err) {
				throw new StoreError( err, "_removeFromIndex" );
			} finally {
				delete this._index[record.key];
			}
		},

		_storeRecord: function (/*any*/ value, /*PutDirectives*/ options) {
			// summary:
			//		Add a record to the store. Throws a StoreError of type ConstraintError
			//		if the key already exists and noOverwrite is set to true.
			// value:
			//		Record value property
			// options:
			//		Optional, PutDirectives
			// returns:
			//		Record key.
			// tag:
			//		Private
			var newRec, newVal, event, before, cb, at, i;
			var optKey, overwrite = false;
			
			if (options) {
				overwrite = "overwrite" in options ? !!options.overwrite : false;
				optKey    = options.key != undef ? options.key : (options.id != undef ? options.id : null);
				before    = options.before || null;
				
				if (before) {
					if (isObject(before)) {
						before = this.getIdentity(before);
					}
					before = this._retrieveRecord(before);
				}
			}

			// Test if the primary key already exists.
			var baseVal  = Keys.getKey(this, value, optKey);
			var keyVal   = this.uppercase ? Keys.toUpperCase(baseVal) : baseVal;
			var locator  = this._retrieveRecord(keyVal);
			var location = {at: locator.eq, from:locator.eq};
			var curRec   = locator.record;
			var curVal   = curRec && curRec.value;
			var curAt    = locator.eq;
			
			if (curRec) {
				if (!overwrite) {
					throw new StoreError("ConstraintError", "_storeRecord", "record with key [%{0}] already exist", keyVal);
				}
				this._removeFromIndex( curRec );
			}

			try {
				newVal = this._clone ? clone(value) : value;
				newRec = new Record( keyVal, newVal );
			} catch(err) {
				throw new StoreError( "DataCloneError", "_storeRecord" );
			}

			if (before && before.record) {
				this._moveRecord(newRec, curAt, before.eq);
				at = location.at = before.eq;
			} else {
				at = curRec ? curAt : this._records.length;
				if (curRec) {
					this._records[at] = newRec;
				} else {
					this._records.push( newRec );
				}
				this._indexRecord(newRec, at);
				location.at = at;
			}
			this.total = this._records.length;
			this.revision++;
			
			// Check if any extension added a callback.
			this._callbacks.fireWithOptions("write", keyVal, value, curVal, at, options );

			// Next, Event handling ....
			if (!this.suppressEvents) {
				if (curRec) {
					event = new Event( "change", {detail:{item: value, oldItem: curVal}});
				} else {
					event = new Event( "new", {detail:{item: value}});
				}
				lang.mixin( event.detail, location );
				this.dispatchEvent( event );
			}
			return keyVal;
		},

		//=========================================================================
		// Public IndexedStore/api/store API methods

		count: function (/*any*/ key) {
			// summary:
			//		Count the total number of objects that share the key or key range.
			// key:
			//		Key identifying the record to be retrieved. The key arguments can
			//		also be an KeyRange.
			// returns:
			//		Total number of records matching the key or key range. If the key
			//		argument is omitted the total number of records in the store is
			//		returned.
			// tag:
			//		Public

			this._assertStore( this, "count" );
			if (key != undef) {
				if (key instanceof KeyRange) {
					return this._getInRange(key).length;
				}
				return (this.get(key) ? 1 : 0);
			}
			return this.total;
		},

		toString: function () {
			return "[object Natural]";
		}

	};	/* end _Natural {} */

	return declare( [], _Natural );

});
