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
				"./Keys",
				"./KeyRange",
				"./Library",
				"./Location",
				"./Record",
				"../error/createError!../error/StoreErrors.json",
				"../transaction/_opcodes"
			 ], function (declare, Keys, KeyRange, Lib, Location, Record, createError, _opcodes) {
	"use strict";
	// module:
	//		IndexedStore/_base/_Natural
	// summary:
	// 		The _Natural class arranges all object store records in a natural order.
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
	// restrictions:
	//		Stores based on the _Natural class do NOT support cursors therefore an
	//		operation like store.openCursor() is not available.  However, you can
	//		still use cursors on an index associated with the store to achieve the
	//		same effect. For example:
	//
	//	|	require(["dojo/_base/declare",
	//	|	         "store/_base/_Store",
	//	|	         "store/_base/_Natural",
	//	|	         "store/_base/_Loader",
	//	|	         "store/_base/KeyRange"
	//	|	        ], function (declare, _Store, _Natural, _Loader, KeyRange) {
	//	|
	//	|	  var store = declare([ _Store, _Natural, _Loader]);
	//	|	  var myStore = new store( {url:"../data/Simpsons.json", keyPath:"name"} );
	//	|	                       ...
	//	|   var index  = store.createIndex("names", "name", {unique:true});
	//	|	  var range  = KeyRange.bound("Bart", "Homer");
	//	|	  var cursor = index.openCursor(range);
	//	|	  while (cursor && cursor.value) {
	//	|	    console.log( "Name: " + cursor.primaryKey );
	//	|	    cursor.cont();
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
	var move       = Lib.move;
	var undef;
	
	var C_MSG_MUTUAL_EXCLUSIVE = "base class '_Natural' and '_Indexed' are mutual exclusive";
	var C_MSG_CONSTRAINT_ERROR = "record with key [%{0}] already exist";
	var C_MSG_DEPENDENCY       = "base class '_Store' must be loaded first";
	
	var _Natural = declare (null, {

		//===================================================================
		// Constructor

		constructor: function () {
			if (this.features.has("store")) {
				if (this.features.has("indexed")) {
					throw new StoreError("Dependency", "constructor", C_MSG_MUTUAL_EXCLUSIVE );
				}
				this._index = {};			// Local record index.

				this.features.add("natural");
				Lib.defProp( this,"natural", {value:true, writable:false, enumerable:true} );
				Lib.protect(this);
			} else {
				throw new StoreError("Dependency", "constructor", C_MSG_DEPENDENCY);
			}
		},

		//===================================================================
		// protected methods.

		_clearRecords: function () {
			// summary:
			//		Remove all records from the store and all indexes.
			// tag:
			//		protected
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
			this.total    = 0;
		},

		//===================================================================
		// IndexedDB procedures

		_deleteKeyRange: function (key) {
			// summary:
			//		Remove all records from store whose key is in the key range.
			// key: KeyRange|Key
			//		Key identifying the record to be deleted. The key arguments can also
			//		be an KeyRange.
			// returns: Boolean
			//		true on successful completion otherwise false.
			// tag:
			//		protected

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
				var rev    = record.rev;
				record.destroy();

				this.total = this._records.length;
				this.revision++;

				if (this.transaction) {
					this.transaction._journal( this, _opcodes.DELETE, key, null, value, rev, recNum );
				} else {
					this._notify( _opcodes.DELETE, key, null, value, rev, recNum );
				}
			}
			return false;
		},

		_getInRange: function (keyRange) {
			// summary:
			//		Get the record numbers, in store order, of all records within the
			//		given key range.
			// keyRange: KeyRange
			//		Instance of KeyRange
			// returns: Number[]
			//		An array of record numbers.
			// tag:
			//		protected
			var i, max = this._records.length;
			var recIdx = [], keyVal;
			
			if (keyRange instanceof KeyRange) {
				for (i = 0; i < max; i++) {
					keyVal = this._records[i].key;
					if (Keys.inRange( keyVal, keyRange )) {
						recIdx.push(i);
					}
				}
			}
			return recIdx;
		},

		_indexRecord: function (/*Record*/ record,/*Number*/ recNum) {
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

		_reindex: function () {
			// summary:
			//		Re-index all store records. This function is called when either a
			//		record is deleted or moved.
			// tag:
			//		protected
			var rec, i, max = this._records.length;
			this._index = {};			// Drop local index.
			for (i=0; i<max; i++) {
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

		_removeFromIndex: function (record) {
			// summary:
			//		Remove a record from all indexes including the local index.
			// record: Record
			//		Record to be removed.
			// tag:
			//		protected
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

		_storeRecord: function (value, options) {
			// summary:
			//		Add a record to the store. Throws a StoreError of type ConstraintError
			//		if the key already exists and noOverwrite is set to true.
			// value: Any
			//		Record value property
			// options: PutDirectives
			//		Optional, PutDirectives
			// returns: Key
			//		Record key.
			// tag:
			//		protected
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
			// Extract key value and test if the primary key already exists.
			var baseVal = Keys.getKey(this, value, optKey);
			var keyVal  = this.uppercase ? Keys.toUpperCase(baseVal) : baseVal;
			// Try to locate the record.
			var curLoc  = this._retrieveRecord(keyVal);
			var curRec  = curLoc.record;
			var curRev  = (curRec && curRec.rev) || 0;
			var curVal  = (curRec && curRec.value);
			var curAt   = curLoc.eq;
			var opType  = curRec ? _opcodes.UPDATE : _opcodes.NEW;
			
			if (curRec) {
				if (!overwrite) {
					throw new StoreError("ConstraintError", "_storeRecord", C_MSG_CONSTRAINT_ERROR, keyVal);
				}
				this._removeFromIndex( curRec );
			}

			try {
				newVal = this._clone ? clone(value) : value;
				newRec = new Record( keyVal, newVal, ++curRev );
			} catch(err) {
				throw new StoreError( "DataCloneError", "_storeRecord" );
			}

			if (before && before.record) {
				move( this._records, curAt, before.eq, newRec );
				this._indexRecord(newRec, before.eq);
				this._reindex();
				at = before.eq;
			} else {
				at = curRec ? curAt : this._records.length;
				if (curRec) {
					this._records[at] = newRec;
				} else {
					this._records.push( newRec );
				}
				this._indexRecord(newRec, at);
			}
			this.total = this._records.length;
			this.revision++;
			
			if (this.transaction) {
				this.transaction._journal( this, opType, keyVal, value, curVal, curRev, curAt, options);
			} else {
				this._notify( opType, keyVal, value, curVal, curRev, curAt, options);
			}
			return keyVal;
		},

		//=========================================================================
		// Public IndexedStore/api/store API methods

		count: function (key) {
			// summary:
			//		Count the total number of objects that share the key or key range.
			// key: Key|KeyRange
			//		Key identifying the record to be retrieved. The key arguments can
			//		also be an KeyRange.
			// returns: Number
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
			return "[object Store]";
		}

	});	/* end declare() */

	return _Natural;

});
