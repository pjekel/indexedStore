//
// Copyright (c) 2012, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define(["dojo/_base/lang",
				"dojo/Deferred",
			  "./Cursor",
			  "./Keys",
			  "./KeyRange",
			  "./Library",
			  "./Record",
				"../error/createError!../error/StoreErrors.json"
			 ], function (lang, Deferred, Cursor, Keys, KeyRange, Lib, Record, createError) {
	"use strict";

	//module:
	//		store/_base/index
	// summary:
	//		This module implements the IDBIndexSync interface.
	//
	//			http://www.w3.org/TR/IndexedDB/#index-sync
	
	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;

	var IDBIndexOptions = { unique: false, multiEntry: false, async: false };
	var StoreError = createError( "Index" );		// Create the StoreError type.
	var debug = dojo.config.isDebug || false;
	var undef;
	
	function Index (/*Store*/ store, /*DOMString*/ name, /*any*/ keyPath, /*Object*/ optionalParameters) {
		// summary:
		//		Implements the IDBIndexSync interface
		// store:
		//		A IDBObjectStore object which is the parent of the new index.
		// name:
		//		The name of a new index.
		// keyPath:
		//		The key path used by the new index.
		// optionalParameters:
		//		The options object whose attributes are optional parameters to this
		//		function. unique specifies whether the index's unique flag is set.
		//		multiEntry specifies whether the index's multiEntry flag is set.
		//
		//		indexOptions {
		//			unique: false,
		//			multiEntry: false
		//		}
		//
		// tag:
		//		Public

		//=========================================================================

		function assert(/*IDBIndex*/ index, /*any?*/ key, /*Boolean*/ optional) {
			// summary:
			//		Validate if the index and associated store have not been destroyed.
			// index:
			//		Index to assert, typically the thisObject.
			// tag:
			//		Private
			if ( index._destroyed || index.store._destroyed || index.store._beingDestroyed ) {
				throw new StoreError("InvalidStateError", "assert");
			}
			if (key) {
				if (!(key instanceof KeyRange) && !Keys.validKey(key)) {
					throw new StoreError("DataError", "assert", "Invalid key or key range");
				}
			} else if (!optional) {
				throw new StoreError("ParameterMissing", "assert", "key is a required argument");
			}
		}

		function addIndexRecord(/*IDBIndex*/ index, /*any*/ indexKey, /*any*/ storeKey ) {
			// summary:
			//		Add a new record to the index.
			// index:
			//		Index to which the record is added.
			// record:
			//		Index Record to insert.
			// tag:
			//		Private
			var locator = Keys.search(index, indexKey);
			var record  = locator.record;
			
			if (record) {
				if (record.value.push(storeKey) > 1) {
					if (!index.unique && !index.loading) {
						record.value.sort();
					}
				}
			} else {
				var record = new Record( indexKey, [storeKey]);
				index._records.splice(locator.gt, 0, record);
			}
		}

		function indexStore( index, store, defer ) {
			// summary:
			//		Index all existing store records.
			// index:
			//		The IDBIndex in which the keys are stored.
			// store:
			//		The IDBObjectStore to index.
			// tag:
			//		Private
			var records = store._records, i;
			var count = 0, dup;
			try {
				if (debug) {Lib.debug("Start loading index ["+index.name+"]");}
				index.loading = true;
				records.forEach( index._add, index );
				// If duplcates are allowed, sort them in ascending order.
				if (!index.unique) {
					index._records.forEach( function (record) {
						if ((dup = record.value.length) > 1) {
							record.value.sort();
						}
						count += dup;
					});
				} else {
					count = index._records.length;
				}
				if (debug) {Lib.debug("End loading index ["+index.name+"], "+index._records.length+" unique, "+count+" total");}
				defer.resolve(index);		// Index is ready.
			} catch(err) {
				var error = new StoreError( err, "indexStore" );
				defer.reject(error);
				throw error;
			} finally {
				delete index.loading;
			}
		}

		//=========================================================================
		// Database operations (http://www.w3.org/TR/IndexedDB/#database-operations)

		function retrieveIndexValue(/*IDBIndex*/ index, /*any*/ key ) {
			// summary:
			//		Retrieve the value of an index record.
			// index:
			//		Index to retrieve the value from, typically the thisObject.
			// key:
			//		Index key.
			// tag:
			//		Private
			var locator;
			if (key instanceof KeyRange) {
				locator = Keys.rangeToLocation( Keys.getRange(index, key) );
			} else {
				locator = Keys.search(index, key);
			}
			if (locator.record) {
				return locator.record.value[0];
			}
		}

		function retrieveReferenceValue(/*IDBIndex*/ index, /*any*/ key ) {
			// summary:
			//		Retrieve the referenced value from a store and return a structured
			//		clone.
			// index:
			//		Index to retrieve the value from, typically the thisObject.
			// key:
			//		Index key.
			// tag:
			//		Private
			var indexValue = retrieveIndexValue( index, key );
			if (indexValue) {
				var value = index.store.get( indexValue );
				if (value) {
					return value;
				}
				// we should never get here....
				throw new StoreError("InvalidStateError", "retrieveReferenceValue", "store and index are out of sync");
			}
		}

		//=========================================================================
		// Private methods

		this._add = function (/*Record*/ storeRecord ) {
			// summary:
			//		Add an index entry for the store record. If the index key is an array
			//		and multiEntry is enabled an index entry is created for each element
			//		in the index key array. If the index key already exists and unique is
			//		true a StoreError of type ConstraintError is thrown.
			// storeRecord:
			//		Store record to index
			// exception:
			//		ConstraintError
			// tag:
			//		Private

			function hasKey(/*IDBIndex*/ index, /*any*/ indexKey) {
				// summary:
				//		Return true if an index key already exists otherwise false. If the
				//		key is an array and multiEntry is enabled each entry in the array
				//		is tested.
				// index:
				// indexKey:
				// tag:
				//		Private
				if (indexKey instanceof Array && index.multiEntry) {
					return indexKey.some( function(key) {
										return !!Keys.search(index, key).record;
									});
				}
				return !!Keys.search(index, indexKey).record;
			}

			if (storeRecord instanceof Record) {
				var indexKey = Keys.indexKeyValue( this.keyPath, storeRecord.value );
				if (indexKey) {
					if (!hasKey(this, indexKey) || !this.unique) {
						if (this.multiEntry) {
							if (indexKey instanceof Array) {
								// Add an index record for each array element.
								indexKey.forEach( function(key) {
									addIndexRecord( this, key, storeRecord.key );
								}, this);
								return;
							}
						}
						// Add a single index record.
						addIndexRecord( this, indexKey, storeRecord.key );
					} else {
						throw new StoreError("ConstraintError", "_add", "Key [%{0}] already exist in index [%{1}]", 
																indexKey, this.name);
					}
				}
			}
		};

		this._clear = function() {
			// summary:
			//		Remove all records from the index.
			// tag:
			//		Private
			this._records = [];
		};

		this._destroy = function () {
			// summary:
			//		Destroy the index.
			// tag:
			//		Private
			this._destroyed = true;
			this._clear();
		};

		this._remove = function (/*Record*/ storeRecord) {
			//summary:
			//		Remove all index records whose value matches the store key if any
			//		such records exist. Note: index records are structured as follows:
			//		{ key: indexKey, value: [storeKey1, storeKey2, storeKey3, .. ]}.
			// storeRecord:
			//		Store record whose index record(s) are to be deleted.
			// tag:
			//		Private
			var indexKey   = Keys.indexKeyValue( this.keyPath, storeRecord.value );
			var storeKey   = storeRecord.key;
			var candidates = [];
			var location;
			var i;

			if (indexKey) {
				// First, based on the index key(s) collect all candidate index records.
				if (indexKey instanceof Array && this.multiEntry) {
					indexKey.forEach( function (key) {
						location = Keys.search(this, key);
						if (location.record) {
							for (i=location.eq; i<location.gt; i++) {
								candidates.push(i);
							}
						}
					}, this);
				} else {
					location = Keys.search(this, indexKey);
					if (location.record) {
						candidates.push(location.eq);
					}
				}
				// Of all candidate index records get only those whose value length equals
				// zero AFTER removing the store key.
				candidates = candidates.filter( function (recNum) {
					var value = this._records[recNum].value;
					var index = value.indexOf(storeKey);
					// If the index record value contains the store key, remove it from the
					// record value.
					if (index != -1) {
						value.splice(index,1);
						return (value.length == 0);
					}
					return false;
				}, this);

				// If any candidates are left reverse the record order (descending) and delete
				// the records starting with the highest record number.
				if (candidates.length > 0) {
					candidates.reverse().forEach( function(recNum) {
						this._records.splice(recNum,1);
					}, this);
				}
			}
		};

		//=========================================================================
		// Public methods

		this.count = function (/*any*/ key) {
			// summary:
			//		Count the total number of records that share the key or key range and
			//		return that value as the result for the IDBRequest.
			// key:
			//		Key identifying the record to be retrieved. The key arguments can also
			//		be an KeyRange.
			// returns:
			//		An IDBRequest object.
			// exceptions:
			//		DataError
			//		InvalidStateError
			//		TransactionInactiveError
			// tag:
			//		Public

			assert( this, key, true );
			if (key) {
				if (!(key instanceof KeyRange)) {
					key = KeyRange.only( key );
				}
			} else {
				key = KeyRange.bound("", "");
			}

			var range = Keys.getRange(this, key);
			var count = 0, i;
			
			if (range.length) {
				for (i = range.first; i <= range.last; i++) {
					count += this._records[i].value.length;
				}
			}
			return count;
		};

		this.get = function (/*any*/ key) {
			// summary:
			//		Get the first record that matches key. The store record value is
			//		returned as the result of the IDBRequest.
			// key:
			//		Key identifying the record to be retrieved. This can also be an
			//		KeyRange in which case the function retreives the first existing
			//		value in that range.
			// returns:
			//		An IDBRequest object.
			// exceptions:
			//		DataError
			//		InvalidStateError
			//		TransactionInactiveError
			// example:
			//		| var request = index.get( myKey );
			//		| request.onsuccess = function (event) {
			//		|   var value = this.result;
			//		| };
			//
			//		Alternatively:
			//
			//		| var request = index.get( myKey );
			//		| request.addEventListener( "success", function (event) {
			//		|   var value = this.result;
			//		| });
			// tag:
			//		Public

			assert( this, key );
			return retrieveReferenceValue( this, key );
		};

		this.getKey = function (/*any*/ key) {
			// summary:
			//		Get the first record that matches key.   The index record value, that
			//		is, the primary key of the referenced store is returned as the result
			//		of the IDBRequest.
			// key:
			//		Key identifying the record to be retrieved. This can also be an
			//		KeyRange in which case the function retreives the first existing
			//		value in that range.
			// returns:
			//		An IDBRequest object.
			// exceptions:
			//		DataError
			//		InvalidStateError
			//		TransactionInactiveError
			// tag:
			//		Public
			assert(this, key);

			return retrieveIndexValue( this, key );
		};

		this.openCursor = function (/*any*/ range, /*DOMString*/ direction) {
			// summary:
			//		Open a new cursor. A cursor is a transient mechanism used to iterate
			//		over multiple records in the store.
			// range:
			//		The key range to use as the cursor's range.
			// direction:
			//		The cursor's required direction.
			// returns:
			//		A cursorWithValue object.
			// example:
			//		| var request = store.openCursor();
			//		| request.onsuccess = function (event) {
			//		|   var cursor = this.result;
			//		|   if (cursor) {
			//		|       ...
			//		|     cursor.continue();
			//		|   }
			//		| };
			// tag:
			//		Public
			var range = range || null;

			if (range) {
				if (Keys.validKey(range)) {
					range = KeyRange.only( range );
				}
			}
			var cursor = new Cursor( this, range, direction, false );
			return cursor;
		};

		this.openKeyCursor = function (/*any*/ range, /*DOMString*/ direction) {
			// summary:
			//		Open a new cursor. A cursor is a transient mechanism used to iterate
			//		over multiple records in the store.
			// range:
			//		The key range to use as the cursor's range.
			// direction:
			//		The cursor's required direction.
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
			var range = range || null;

			if (range) {
				if (Keys.validKey(range)) {
					range = KeyRange.only( range );
				}
			}
			var cursor = new Cursor( this, range, direction, true );
			return cursor;
		};

		this.ready = function (/*Function?*/ callback,/*Function?*/ errback,/*thisArg*/ scope) {
			// summary:
			//		Execute the callback when the store has been loaded. If an error
			//		is detected that will prevent the store from getting ready errback
			//		is called instead.
			// note:
			//		When the promise returned resolves it merely indicates one of
			//		potentially many load requests was successful. To keep track of
			//		a specific load request use the promise returned by the load()
			//		function instead.
			// callback:
			//		Function called when the store is ready.
			// errback:
			//		Function called when a condition was detected preventing the store
			//		from getting ready.
			// scope:
			//		The scope/closure in which callback and errback are executed. If
			//		not specified the store is used.
			// returns:
			//		dojo/promise/Promise
			// tag:
			//		Public
			if (callback || errback) {
				this._indexReady.then(
					callback ? lang.hitch( (scope || this), callback) : null, 
					errback  ? lang.hitch( (scope || this), errback)  : null
				);
			}
			return this._indexReady.promise;
		};

		//=========================================================================

		if (typeof name === "string" && keyPath && store) {
			var indexOptions   = lang.mixin( IDBIndexOptions, optionalParameters || {});

			// If keyPath is and Array and the multiEntry property is true throw an
			// exception of type NotSupportedError.
			if (keyPath instanceof Array && !!indexOptions.multiEntry) {
				throw new StoreError("NotSupportedError", "constructor", "KeyPath cannot be an array when multiEntry is enabled");
			}
			this._indexReady = new Deferred();
			this._records    = [];

			this.multiEntry = !!indexOptions.multiEntry;
			this.unique     = !!indexOptions.unique;
			this.name       = name;
			this.keyPath    = keyPath;
			this.store      = store;
			this.type       = "index";

			var async = !!indexOptions.async;
			var index = this;

			if (async) {
				setTimeout( function () {
					indexStore( index, store, index._indexReady );
				}, 0);
			} else {
				indexStore( index, store, index._indexReady );
			}

			Lib.enumerate( this, ["_add", "_clear", "_destroy", "_remove"], false);
			Lib.enumerate( this, "_indexReady", false);
			Lib.writable( this, "type", false );

		} else {
			throw new StoreError( "SyntaxError", "constructor" );
		}

	} /* end StoreIndex */

	return Index;

});
