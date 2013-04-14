//
// Copyright (c) 2012-2013, Peter Jekel
// All rights reserved.
//
//	The Checkbox Tree (cbtree) is released under to following three licenses:
//
//	1 - BSD 2-Clause								(http://thejekels.com/cbtree/LICENSE)
//	2 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	3 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/declare",
				"dojo/store/util/QueryResults",
				"../_base/Cursor",
				"../_base/Keys",
				"../_base/KeyRange",
				"../_base/Library",
				"../_base/Record",
				"../error/createError!../error/StoreErrors.json",
				"../dom/event/Event"
			 ], function (declare, QueryResults, Cursor, Keys, KeyRange, Lib, 
										 Record, createError, Event) {
	"use strict";
	// module:
	//		store/_base/_Indexed
	// summary:
	// 		The _Indexed class is used in combination with the store/_base/_Store
	//		class and will organize all object store records in a binary tree.
	//		As a result, this type of store also support the use of cursors. For
	//		detailed information on cursors please refer to:
	//
	//			http://www.w3.org/TR/IndexedDB/#cursor-concept
	//
	//		As each store comes with a query engine you can combine cursors and the
	//		query engine to perform some powerful queries. You can, for example,
	//		pass a cursor directly to the query engine:
	//
	//	|	var range  = KeyRange.bound("Bart", "Homer");
	//	| var cursor = store.openCursor( range );
	//	| var query  = {type:"parent", hair:"blond"}
	//	| var result = store.queryEngine(query)(cursor); 
	//
	// restrictions:
	//		Stores based on the _Indexed class do NOT support the PutDirective
	//		'before'. If a natural record order is required by your application
	//		for example, you want to support 'before' with Drag-n-Drop, use the
	//		_Natural class instead.
	// NOTE:
	//		The _Indexed base class does NOT determine if a store can have an index
	//		or not, it merely determines the internal record structure, but because
	//		the records are structures in a binary tree the store itself can be used
	//		as an index itself.
	//
	// example:
	//	|	require(["dojo/_base/declare",
	//	|	         "store/_base/_Store",
	//	|	         "store/_base/_Indexed",
	//	|	         "store/_base/KeyRange",
	//	|	         "store/extension/Loader"
	//	|	        ], function (declare, _Store, _Indexed, KeyRange, Loader) {
	//	|
	//	|	  var store = declare([_Store, _Indexed, Loader]);
	//	|	  var myStore = new store( {url:"../data/Simpsons.json", keyPath:"name"} );
	//	|	                       ...
	//	|	  var range  = KeyRange.bound("Bart", "Homer");
	//	|	  var cursor = store.openCursor(range);
	//	|	  while (cursor && cursor.value) {
	//	|	    console.log( "Name: " + cursor.primaryKey );
	//	|	    cursor.continue();
	//	|	  } 
	//	|	});
	
	var StoreError = createError( "Indexed" );		// Create the StoreError type.
	var isObject   = Lib.isObject;
	var clone      = Lib.clone;										// HTML5 structured clone.
	var undef;
	
	var _Indexed = {

		//===================================================================
		// Constructor

		constructor: function () {
			if (this.features.has("indexed")) {
				throw new StoreError("ConstraintError", "constructor", "base class 'Natural' and 'Indexed' are mutual exclusive");
			}
			this.features.add("indexed");
			Lib.defProp( this,"indexed", {value:true, writable:false, enumerable: true} );
			Lib.protect(this);
		},
		
		//===================================================================
		// IndexedDB procedures

		_deleteKeyRange: function (/*Key|KeyRange*/ key ) {
			// summary:
			//		Remove all records from store whose key is in the key range.
			// key:
			//		Key identifying the record to be deleted. The key arguments can also
			//		be an KeyRange.
			// tag:
			//		Private
			var deleted = false;

			if( !(key instanceof KeyRange)) {
				key = KeyRange.only(key);
			}
			var range = Keys.getRange( this, key );
			if (range.record) {
				var event, i;
				
				for (i=range.last; i >= range.first; i--) {
					event   = new Event("delete", {detail:{item: this._records[i].value}});
					deleted = this._deleteRecord( this._records[i], i );
					if (deleted) {
						this.dispatchEvent(event);
					}
				}
			}
			return !!deleted;
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
			var name, index;

			if (record && typeof recNum == "number") {
				try {
					this._removeFromIndex( record );
				} catch (err) {
					throw new StoreError( err, "_deleteRecord" );
				} finally {
					// Make sure we destroy the real store record and not a clone.
					record = this._records.splice( recNum, 1 )[0];
					record.destroy();
					this.total = this._records.length;
					return true;
				}
			}
			return false;
		},

		_indexRecord: function (/*Record*/ record) {
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
				this._removeFromIndex( record );
				throw new StoreError(err, "_indexRecord");
			}
		},

		_retrieveRecord: function (/*any*/ key ) {
			// summary:
			//		Retrieve the first record from the store whose key matches key and
			//		return a locator object if found.
			// store:
			//		The Store to retrieve the record from.
			// key:
			//		Key identifying the record to be retrieved. The key arguments can also
			//		be an KeyRange.
			// returns:
			//		A location object. (see the Location module for detais).
			// tag:
			//		Private
			if (key instanceof KeyRange) {
				return Keys.rangeToLocation( Keys.getRange(this, key) );
			}
			return Keys.search(this, key);
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
			}
		},

		_storeRecord: function (/*any*/ value,/*PutDirectives*/ options, /*Function?*/ callback) {
			// summary:
			//		Add a record to the store. Throws a StoreError of type ConstraintError
			//		if the key already exists and overwrite flag is set to true.
			// NOTE:
			//		Indexed stores do not include location information in events as the
			//		record location is not related to any natural order.
			// value:
			//		Record value property
			// options:
			//		Optional, PutDirectives
			// returns:
			//		Record key.
			// tag:
			//		Private
			var curRec, newRec, event;
			var optKey, overwrite = true;
			
			if (options) {
				overwrite = "overwrite" in options ? !!options.overwrite : true;
				optKey    = options.key || options.id || null;
			}

			// Test if the primary key already exists.
			var baseVal = Keys.getKey(this, value, optKey);
			var keyVal  = this.uppercase ? Keys.toUpperCase(baseVal) : baseVal;
			var locator = this._retrieveRecord(keyVal);
			var curRec  = locator.record;
			var at      = locator.eq;
			
			if (curRec) {
				if (!overwrite) {
					throw new StoreError("ConstraintError", "_storeRecord", "record with key [%{0}] already exist", keyVal);
				}
				this._removeFromIndex( curRec );
			}

			value = callback ? callback.call( this, keyVal, value, options) : value;
			try {
				value  = this._clone ? clone(value) : value;
				newRec = new Record( keyVal, value );
			} catch(err) {
				throw new StoreError( "DataCloneError", "_storeRecord" );
			}

			at = curRec ? at : locator.gt;
			// Index the record first in case an error occurs.
			this._indexRecord( newRec );
			if (curRec) {
				this._records[at] = newRec;
			} else {
				this._records.splice( at, 0, newRec );
			}
			// Next, event handling ....
			if (!this.suppressEvents) {
				if (curRec) {
					event = new Event( "change", {detail:{item: value, oldItem: curRec.value}});
				} else {
					event = new Event( "new", {detail:{item: value}});
				}
				this.dispatchEvent( event );
			}
			this.total = this._records.length;
			return keyVal;
		},

		//=========================================================================
		// Public store/api/store API methods

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
				if (!(key instanceof KeyRange)) {
					key = KeyRange.only( key );
				}
				var range = Keys.getRange(this, key);
				return range.length;
			}
			return this.total;
		},
		
		openCursor: function (/*any?*/ range, /*DOMString?*/ direction) {
			// summary:
			//		Open a new cursor. A cursor is a transient mechanism used to iterate
			//		over multiple records in the store.
			// range:
			//		The key range to use as the cursor's range.
			// direction:
			//		The cursor's required direction. Valid options are: 'next', 'nextunique',
			//		'prev' or 'prevunique'.
			// returns:
			//		A cursorWithValue object.
			// example:
			//		| var cursor = store.openCursor();
			//		| while( cursor && cursor.value ) {
			//		|       ...
			//		|     cursor.continue();
			//		| };
			// tag:
			//		Public

			this._assertKey( range, "openCursor", false );
			// If there's only argument test if it is the 'direction'...
			if (arguments.length == 1) {
				switch(arguments[0]) {
					case "next": 
					case "nextunique": 
					case "prev": 
					case "prevunique":
						direction = arguments[0];
						range = undef;
						break;
				}
			}

			if (!(range instanceof KeyRange)) {
				if (range != undef) {
					range = KeyRange.only( range );
				} else {
					range = null;
				}
			}
			var cursor  = new Cursor( this, range, direction, false );
			return cursor;
		},

		toString: function () {
			return "[object Indexed]";
		}

	};	/* end _Indexed {} */
	
	return declare( [], _Indexed );

});
