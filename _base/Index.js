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
				"dojo/Deferred",
				"dojo/store/util/QueryResults",
			  "./Cursor",
			  "./Keys",
			  "./KeyRange",
			  "./Library",
				"./Range",
			  "./Record",
			  "../dom/event/Event",
			  "../dom/event/EventTarget",
				"../error/createError!../error/StoreErrors.json",
				"../util/QueryEngine",
			 ], function (lang, Deferred, QueryResults, Cursor, Keys, KeyRange, 
										 Lib, Range, Record, Event, EventTarget,
										 createError, QueryEngine) {
	"use strict";

	//module:
	//		store/_base/index
	// summary:
	//		This module implements the IDBIndexSync interface.
	//
	//			http://www.w3.org/TR/IndexedDB/#index-sync
	
	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;

	// Define default index properties.
	var IDBIndexOptions = { unique: false, 
	                        multiEntry: false, 
	                        uppercase: false, 
	                        async: false };

	var StoreError = createError( "Index" );		// Create the StoreError type.
	var isObject = Lib.isObject;
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

		function assertKey(/*IDBIndex*/ index, /*any?*/ key, /*String*/ method, /*Boolean?*/ required) {
			// summary:
			//		Validate if the index and associated store have not been destroyed.
			// index:
			//		Index to assert, typically the thisObject.
			// tag:
			//		Private
			if ( index._destroyed || index.store._destroyed || index.store._beingDestroyed ) {
				throw new StoreError("InvalidStateError", method);
			}
			if (key != undef) {
				if (!(key instanceof KeyRange) && !Keys.validKey(key)) {
					throw new StoreError("DataError", method, "Invalid key or key range");
				}
			} else if (required) {
				throw new StoreError("ParameterMissing", method, "key is a required argument");
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
			index._updates++;
		}

		function indexStore( store, index, defer ) {
			// summary:
			//		Index all existing store records.
			// store:
			//		Store.
			// index:
			//		The IDBIndex in which the keys are stored.
			// tag:
			//		Private
			var records = store._records;
			var count = 0, dup, i;
			try {
				if (debug) {Lib.debug("Start building index ["+index.name+"]");}
				index.loading = true;
				index._clear();
				records.forEach( index._add, index );
				count = sortDuplicates( index );
				if (debug) {Lib.debug("End building index ["+index.name+"], "+index._records.length+" unique, "+count+" total");}
				defer.resolve(index);		// Index is ready.
			} catch(err) {
				var error = new StoreError( err, "indexStore" );
				defer.reject(error);
				throw error;
			} finally {
				delete index.loading;
			}
		}

		function onStoreEvent (evt) {
			// summary:
			//		Local store event handler.
			// evt:
			//		Store event.
			// tag:
			//		Private
			switch( evt.type ) {
				case "loadStart":
					this.loading = true;
					this._updates = 0;
					break;
				case "loadFailed":
				case "loadEnd":
					if (this.loading) {
						delete this.loading;
						sortDuplicates( this );
					}
					break;
			}
		}

		function sortDuplicates( index ) {
			// summary:
			//		Sort all duplicate index entries. This method is called when either
			//		a store was indexed or a store load request completed, this because
			//		during both such events the sorting of duplicate index entries is
			//		suspended for performance reasons.
			// returns:
			//		Total number of records in the index.
			// tag:
			//		Private
			var records = index._records;
			var count = 0, dup;

			// Only sort when strictly required.
			if (!index.unique && index._updates) {
				records.forEach( function (record) {
					if ((dup = record.value.length) > 1) {
						Keys.sort( record.value );
					}
					count += dup;
				});
			} else {
				count = records.length;
			}
			return count;
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
			var record;
			if (key instanceof KeyRange) {
				record = Keys.getRange(index, key).record;
			} else {
				key = index.uppercase ? Keys.toUpperCase(key) : key;
				record = Keys.search(index, key).record;
			}
			if (record) {
				return record.value[0];
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
				var indexKey = Keys.keyValue( this.keyPath, storeRecord.value );
				if (indexKey) {
					if (this.multiEntry && indexKey instanceof Array) {
						// Remove duplicate elements and invalid key values.
						indexKey = Keys.purgeKey( indexKey );
					}
					if (Keys.validKey(indexKey)) {
						indexKey = index.uppercase ? Keys.toUpperCase( indexKey ) : indexKey;
						if (!hasKey(this, indexKey) || !this.unique) {
							if (this.multiEntry && indexKey instanceof Array) {
								indexKey.forEach( function(key) {
									addIndexRecord( this, key, storeRecord.key );
								}, this);
								return;
							}
							// Add a single index record.
							addIndexRecord( this, indexKey, storeRecord.key );
						} else {
							throw new StoreError("ConstraintError", "_add", "Key [%{0}] already exist in index [%{1}]", 
																	indexKey, this.name);
						}
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
			var indexKey   = Keys.keyValue( this.keyPath, storeRecord.value );
			var storeKey   = storeRecord.key;
			var candidates = [];
			var location;
			var i;

			if (indexKey) {
				if (this.uppercase) {
					indexKey = Keys.toUpperCase(indexKey);
				}
				// First, based on the index key(s) collect all candidate index records.
				if (indexKey instanceof Array && this.multiEntry) {
					indexKey = Keys.purgeKey(indexKey);
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

		Lib.enumerate( this, "_add, _clear, _destroy, _remove", false);

		//=========================================================================
		// Public methods

		this.count = function (/*any?*/ key,/*Boolean?*/ unique) {
			// summary:
			//		Count the total number of records that share the key or key range and
			//		return that value as the result for the IDBRequest.
			// key:
			//		Key identifying the record to be retrieved. The key arguments can also
			//		be an KeyRange.
			// unique:
			//		If true only unique index entries are counted otherwise all entries
			//		are counted.
			// returns:
			//		Number of index entries.
			// tag:
			//		Public

			if (arguments.length == 1) {
				if (typeof arguments[0] == "boolean") {
					unique = arguments[0];
					key    = undef;
				}
			}
			assertKey( this, key, "count", false );
			if (key != undef) {
				if (!(key instanceof KeyRange)) {
					key = KeyRange.only( this.uppercase ? Keys.toUpperCase(key) : key );
				}
			} else {
				key = KeyRange.unbound();
			}

			var range = Keys.getRange(this, key);
			var count = 0, i;
			
			if (range.length) {
				if (!unique) {
					for (i = range.first; i <= range.last; i++) {
						count += this._records[i].value.length;
					}
				} else {
					count = range.length;
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
			// tag:
			//		Public

			assertKey( this, key, "get", true );
			return retrieveReferenceValue( this, key );
		};

		this.getKey = function (/*any*/ key) {
			// summary:
			//		Get the first record that matches key. The index record value, that
			//		is, the primary key of the referenced store is returned.
			// key:
			//		Key identifying the record to be retrieved. This can also be an
			//		KeyRange in which case the function retreives the first existing
			//		value in that range.
			// returns:
			//		The index key value.
			// tag:
			//		Public
			assertKey(this, key, "getKey", true);
			return retrieveIndexValue( this, key );
		};

		this.getRange = function (/*Key|KeyRange?*/ keyRange,/*String?*/ direction, /*Boolean?*/ duplicates) {
			// summary:
			//		Retrieve a range of store records.
			// keyRange:
			//		A KeyRange object or a valid key.
			// direction:
			//		The range's required direction.
			// duplicates:
			//		If false, duplicate store record references are ignored. The default
			//		is true.
			// returns: dojo/store/util/QueryResults
			//		The range results, extended with iterative methods.
			// tag:
			//		Public

			var range = keyRange, dir = "next", dup = true;
			if (arguments.length > 1) {
				if (arguments[1] !== null) {
					if (Lib.isDirection(arguments[1])) {
						dir = arguments[1];
						dup = arguments[2];
					} else if (typeof arguments[1] == "boolean") {
						dup = arguments[1];
					} else {
						throw new StoreError("DataError", "getRange");
					}
				} else {
					throw new StoreError("DataError", "getRange");
				}
			}
			dup = dup != undef ? !!dup : true;
			var results = Range( this, range, dir, dup, false );
			return QueryResults( results );
		};

		this.getKeyRange = function (/*Key|KeyRange?*/ keyRange,/*String?*/ direction,/*Boolean?*/ duplicates) {
			// summary:
			//		Retrieve a range of store records.
			// keyRange:
			//		A KeyRange object or a valid key.
			// direction:
			//		The range's required direction.
			// duplicates:
			//		If false, duplicate store reference keys are ignored. The default
			//		is true.
			// returns: dojo/store/util/QueryResults
			//		The range results, extended with iterative methods.
			// tag:
			//		Public

			var range = keyRange, dir = "next", dup = true;
			if (arguments.length > 1) {
				if (arguments[1] !== null) {
					if (Lib.isDirection(arguments[1])) {
						dir = arguments[1];
						dup = arguments[2];
					} else if (typeof arguments[1] == "boolean") {
						dup = arguments[1];
					} else {
						throw new StoreError("DataError", "getKeyRange");
					}
				} else {
					throw new StoreError("DataError", "getKeyRange");
				}
			}
			dup = dup != undef ? !!dup : true;
			var results = Range( this, range, dir, dup, true );
			return QueryResults( results );
		};

		this.openCursor = function (/*Key|KeyRange?*/ keyRange, /*DOMString?*/ direction) {
			// summary:
			//		Open a new cursor. A cursor is a transient mechanism used to iterate
			//		over multiple records in the store.
			// keyRange:
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

			var range = keyRange, dir = "next";
			if (arguments.length > 1) {
				if (arguments[1] && Lib.isDirection(arguments[1])) {
					dir = arguments[1];
				} else {
					throw new StoreError("DataError", "openCursor");
				}
			}
			var cursor = new Cursor( this, range, dir, false );
			return cursor;
		};

		this.openKeyCursor = function (/*any?*/ keyRange, /*DOMString?*/ direction) {
			// summary:
			//		Open a new cursor. A cursor is a transient mechanism used to iterate
			//		over multiple records in the store.
			// keyRange:
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

			var range = keyRange, dir = "next";
			if (arguments.length > 1) {
				if (arguments[1] && Lib.isDirection(arguments[1])) {
					dir = arguments[1];
				} else {
					throw new StoreError("DataError", "openKeyCursor");
				}
			}
			var cursor = new Cursor( this, range, dir, true );
			return cursor;
		};

		this.query = function (/*Object*/ query,/*QueryOptions?*/ options) {
			// summary:
			//		Queries the index for objects.
			// query: Object
			//		The query to use for retrieving objects from the store.
			// options:
			//		The optional arguments to apply to the resultset.
			// returns: dojo/store/api/Store.QueryResults
			//		The results of the query, extended with iterative methods.
			// tag:
			//		Public
			var results = [], keys = [];
			
			// To query index keys the query must at least have a 'key' property.
			if (query && query.key) {
				results = this.queryEngine(query, options)(this._records, true);
				if (results.length) {
					results.forEach( function (primKeys) {
						if (options.nextUnique) {
							keys.push(primKeys[0]);						
						} else {
							primKeys.forEach( function (key) {
								if (Keys.indexOf(keys,key) == -1) {
									keys.push(key);
								}
							}, this);
						}
					}, this);

					results = keys.map( function (key) {
						return this.store.get( key );
					}, this);
				}
			}
			return QueryResults( results );
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
			var indexOptions = lang.mixin( Lib.clone(IDBIndexOptions), optionalParameters || {});
			// If keyPath is and Array and the multiEntry property is true throw an
			// exception of type NotSupportedError.
			if (keyPath instanceof Array && !!indexOptions.multiEntry) {
				throw new StoreError("NotSupportedError", "constructor", "KeyPath cannot be an array when multiEntry is enabled");
			}
			this._indexReady = new Deferred();
			this._records    = [];
			this._updates    = 0;

			this.multiEntry  = !!indexOptions.multiEntry;
			this.unique      = !!indexOptions.unique;
			this.uppercase   = !!indexOptions.uppercase;
			this.name        = name;
			this.keyPath     = keyPath;
			this.store       = store;
			this.type        = "index";
			this.queryEngine = QueryEngine;

			Lib.writable( this, "keyPath, name, store, type, uppercase, multiEntry, unique", false );
			Lib.protect( this );

			var async = !!indexOptions.async;
			var index = this;

			// Add the event listeners
			store.on("loadStart, loadEnd, loadFailed", lang.hitch( this, onStoreEvent ));

			if (async) {
				setTimeout( function () {
					indexStore( store, index, index._indexReady );
				}, 0);
			} else {
				indexStore( store, index, index._indexReady );
			}

		} else {
			throw new StoreError( "SyntaxError", "constructor" );
		}

	} /* end StoreIndex */

	Index.prototype = new EventTarget();
	Index.prototype.constructor = Index;

	return Index;

});
