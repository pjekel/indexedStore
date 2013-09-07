//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/Deferred",
		"dojo/when",
		"./_assert",
		"./Directives",
		"./Cursor",
		"./Keys",
		"./KeyRange",
		"./library",
		"./range",
		"./Record",
		"../dom/event/Event",
		"../dom/event/EventTarget",
		"../error/createError!../error/StoreErrors.json",
		"../util/QueryResults",
		"../util/sorter"
	], function (Deferred, when, assert, Directives, Cursor, Keys, KeyRange, lib, range,
	             Record, Event, EventTarget, createError, QueryResults, sorter) {
	"use strict";

	//module:
	//		store/_base/index
	// summary:
	//		This module implements a synchronous version of the IDBIndex interface.
	//
	//			http://www.w3.org/TR/IndexedDB/#index
	//
	//	In addition to the IDBIndex interface this module provides the following
	//	methods:
	//
	//		getRange()
	//		getKeyRange()
	//		ready()

	var StoreError  = createError("Index");		// Create the StoreError type.
	var isDirection = lib.isDirection;
	var isObject    = lib.isObject;
	var isString    = lib.isString;
	var clone       = lib.clone;
	var mixin       = lib.mixin;

	var readOnly = ["baseClass", "keyPath", "multiEntry", "name", "store", "uppercase", "unique"];

	var indexDirectives = {
		// unique: Boolean
		//		When this flag is true, the index enforces that no two records in
		//		the index has the same key.
		unique: false,

		// multiEntry: Boolean?
		//		If the multiEntry flag is false, then a single record whose key is
		//		an Array is added to the index. If the multiEntry flag is true, then
		//		the one record is added to the index for each item in the Array.
		//		The key for each record is the value of respective item in the Array.
		multiEntry: false,

		// uppercase: Boolean?
		//		Indicates if the object key is to be stored in all uppercase chars.
		//		If true, all key string values are converted to uppercase before
		//		storing the record. The object property values used to compose the
		//		key are not affected.
		uppercase: false,

		// async: Boolean?
		async: false
	};

	function Index(store, name, keyPath, directives) {
		// summary:
		//		Implements a synchronous version of the IDBIndex interface
		// store: Store
		//		An indexedStore object which is the parent of the new index.
		// name: DOMString
		//		The name of a new index.
		// keyPath: KeyPath
		//		The key path used by the new index.
		// directives: IndexDirectives?
		//		JavaScript key:value pairs object specifying the index directives.
		// returns:
		//		A new Index object.
		// tag:
		//		Public

		//=========================================================================
		// private functions

		function addIndexRecord(index, indexKey, storeKey) {
			// summary:
			//		Add a record to the index.
			// description:
			//		Add a record to the index. If the index is loading, that is, the
			//		store is loading or being indexed suppress the sorting of store
			//		references keys (duplicates) until all index records have been
			//		created.
			// index: Index
			//		Index to which the record is added.
			// indexKey: Key
			//		Index key.
			// storeKey: Key
			//		Primary key
			// tag:
			//		Private
			var locator = Keys.search(index, indexKey);
			var record  = locator.record;

			if (record) {
				if (record.value.push(storeKey) > 1) {
					if (!index._loading) {
						Keys.sortKeys(record.value);
					} else {
						record._NS = true;		// Mark record as 'Need Sorting'
					}
				}
			} else {
				record = new Record(indexKey, [storeKey]);
				index._records.splice(locator.gt, 0, record);
			}
			index._updates++;
		}

		function indexStore(store, index, defer) {
			// summary:
			//		Index all existing store records but not until the store finished
			//		loading. This will avoid an index being created while the store is
			//		in the middle of a load request.
			// store: Store
			//		Store.
			// index: Index
			//		The IDBIndex in which the keys are stored.
			// defer: dojo.Deferred
			// tag:
			//		Private
			var delay = store._loading;
			when(delay, function () {
				var records = store._records;
				try {
					index._loading = true;
					index._updates = 0;
					index._clear();
					records.forEach(index._add, index);
					sortDuplicates(index);
					defer.resolve(index);		// Index is ready.
				} catch (err) {
					defer.reject(StoreError.call(err, err, "indexStore"));
					throw error;
				} finally {
					delete index._loading;
				}
			});
		}

		function sortDuplicates(index) {
			// summary:
			//		Sort all duplicate index entries. This method is called when either
			//		a store was indexed or a store load request completed, this because
			//		during both such events the sorting of duplicate index entries is
			//		suspended for performance reasons.
			// index: Index
			// tag:
			//		Private
			var record, records = index._records;
			var i, max = records.length;

			// Only sort when strictly required and only those records that require it.
			if (!index.unique && index._updates) {
				for (i = 0; i < max; i++) {
					record = records[i];
					if (record._NS) {
						Keys.sortKeys(record.value);
						delete record._NS;
					}
				}
			}
		}

		//=========================================================================
		// Database operations (http://www.w3.org/TR/IndexedDB/#database-operations)

		function retrieveIndexValue(index, key) {
			// summary:
			//		Retrieve the value of an index record. If key is a key range, the
			//		value of the first record in range is returned.
			// index: Index
			//		Index to retrieve the value from, typically the thisObject.
			// key: Key|KeyRange
			//		Index key or key range.
			// returns: Object
			// tag:
			//		Private
			var record;
			if (key instanceof KeyRange) {
				record = Keys.getRange(index, key).record;
			} else {
				record = Keys.search(index, key).record;
			}
			if (record) {
				return record.value[0];
			}
		}

		function retrieveReferenceValue(index, key) {
			// summary:
			//		Retrieve the referenced value from a store and return a structured
			//		clone. If key is a key range, the value of the first record in range
			//		is returned.
			// index: Index
			//		Index to retrieve the value from, typically the thisObject.
			// key: Key|KeyRange
			//		Index key or key range.
			// returns: Object
			// tag:
			//		Private
			var indexValue = retrieveIndexValue(index, key);
			var store = index.store;
			if (indexValue) {
				var record = store._retrieveRecord(indexValue);
				if (record) {
					return store._clone ? clone(record.value) : record.value;
				}
				// we should never get here....
				throw new StoreError("InvalidStateError", "retrieveReferenceValue", "store and index are out of sync");
			}
		}

		//=========================================================================
		// Protected methods

		this._add = function (storeRecord) {
			// summary:
			//		Add an index entry for the store record. If the index key is an array
			//		and multiEntry is enabled an index entry is created for each element
			//		in the index key array. If the index key already exists and unique is
			//		true a StoreError of type ConstraintError is thrown.
			// storeRecord: Record
			//		Store record to index
			// tag:
			//		Private

			function hasKey(index, indexKey) {
				// summary:
				//		Return true if an index key already exists otherwise false. If the
				//		key is an array and multiEntry is enabled each entry in the array
				//		is tested.
				// index: Index
				//		Instance of Index
				// indexKey: Key
				// returns: Boolean
				// tag:
				//		Private
				if (indexKey instanceof Array && index.multiEntry) {
					return indexKey.some(function (key) {
						return !!Keys.search(index, key).record;
					});
				}
				return !!Keys.search(index, indexKey).record;
			}

			if (storeRecord instanceof Record) {
				var indexKey = Keys.keyValue(this.keyPath, storeRecord.value, this.uppercase);
				if (indexKey != null) {
					if (this.multiEntry && indexKey instanceof Array) {
						// Remove duplicate elements and invalid key values.
						indexKey = Keys.purgeKey(indexKey);
					}
					if (Keys.validKey(indexKey)) {
						if (!hasKey(this, indexKey) || !this.unique) {
							if (this.multiEntry && indexKey instanceof Array) {
								indexKey.forEach(function (key) {
									addIndexRecord(this, key, storeRecord.key);
								}, this);
								return;
							}
							// Add a single index record.
							addIndexRecord(this, indexKey, storeRecord.key);
						} else {
							throw new StoreError("ConstraintError", "_add", "Key [%{0}] already exist in index [%{1}]",
																	indexKey, this.name);
						}
					}
				}
			}
		};

		this._clear = function () {
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

		this._onLoadTrigger = function (action) {
			// summary:
			//		This method is called when a store loader dispatched one of the
			//		following events: error, load, loadStart or loadCancel
			// event: Event
			//		DOM4 style event.
			// tag:
			//		private, callback
			switch (action) {
				case "loadStart":
					index._loading = true;
					index._updates = 0;
					break;
				case "loadEnd":
					if (index._loading) {
						delete index._loading;
						sortDuplicates(index);
					}
					break;
			}
		};

		this._remove = function (storeRecord) {
			//summary:
			//		Remove all index records whose value matches the store key if any
			//		such records exist. Note: index records are structured as follows:
			//		{ key: indexKey, value: [storeKey1, storeKey2, storeKey3, .. ]}.
			// storeRecord: Record
			//		Store record whose index record(s) are to be deleted.
			// tag:
			//		Private
			var indexKey   = Keys.keyValue(this.keyPath, storeRecord.value, this.uppercase);
			var storeKey   = storeRecord.key;
			var candidates = [];
			var location;
			var i;

			if (indexKey) {
				// First, based on the index key(s) collect all candidate index records.
				if (indexKey instanceof Array && this.multiEntry) {
					indexKey = Keys.purgeKey(indexKey);
					indexKey.forEach(function (key) {
						location = Keys.search(this, key);
						if (location.record) {
							for (i = location.eq; i < location.gt; i++) {
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
				candidates = candidates.filter(function (recNum) {
					var value = this._records[recNum].value;
					var index = Keys.indexOf(value, storeKey);
					// If the index record value contains the store key, remove it from the
					// record value.
					if (index != -1) {
						value.splice(index, 1);
						return (value.length == 0);
					}
					return false;
				}, this);

				// If any candidates are left reverse the record order (descending) and delete
				// the records starting with the highest record number.
				if (candidates.length > 0) {
					candidates.reverse().forEach(function (recNum) {
						this._records.splice(recNum, 1);
					}, this);
				}
			}
		};

		//=========================================================================
		// Public methods

		this.count = function (key, unique) {
			// summary:
			//		Count the total number of records that share the key or key range.
			// key: Key|KeyRange
			//		Key identifying the record to be retrieved. The key arguments can also
			//		be an KeyRange.
			// unique: Boolean
			//		If true only unique index entries are counted otherwise all entries
			//		are counted.
			// returns: Number
			//		Number of index entries.
			// tag:
			//		Public
			var count = 0, i, rangeDsc;
			if (arguments.length == 1) {
				if (typeof key == "boolean") {
					unique = key;
					key    = undefined;
				}
			}
			assert.index(this, "count");
			assert.key(key, "count");
			if (key != null) {
				if (!(key instanceof KeyRange) && Keys.validKey(key)) {
					key = KeyRange.only(key);
				} else {
					throw new StoreError("DataError", "count", "invalid key");
				}
			}
			rangeDsc = Keys.getRange(this, key);
			if (rangeDsc.total) {
				if (!unique) {
					for (i = rangeDsc.first; i <= rangeDsc.last; i++) {
						count += this._records[i].value.length;
					}
				} else {
					count = rangeDsc.total;
				}
			}
			return count;
		};

		this.get = function (key) {
			// summary:
			//		Get the first record that matches key. The store record value is
			//		returned as the result of the IDBRequest.
			// key: Key|KeyRange
			//		Key identifying the record to be retrieved. This can also be an
			//		KeyRange in which case the function retreives the first existing
			//		value in that range.
			// returns:
			// tag:
			//		Public

			assert.index(this, "get");
			assert.key(key, "get", true);
			return retrieveReferenceValue(this, key);
		};

		this.getKey = function (key) {
			// summary:
			//		Get the first record that matches key. The index record value, that
			//		is, the primary key of the referenced store is returned.
			// key: Key|KeyRange
			//		Key identifying the record to be retrieved. This can also be an
			//		KeyRange in which case the function retrieves the first existing
			//		value in that range.
			// returns: Key
			//		The index key value.
			// tag:
			//		Public
			assert.index(this, "getKey");
			assert.key(key, "getKey", true);
			return retrieveIndexValue(this, key);
		};

		this.getRange = function (keyRange, options) {
			// summary:
			//		Retrieve a range of store records.
			// keyRange: Key|KeyRange?
			//		A KeyRange object or a valid key.
			// options: (String|Object)?
			//		If a string, the range required direction: 'next', 'nextunique',
			//		'prev' or 'prevunique'. Otherwise a Store.RangeOptions object.
			// returns: Store.QueryResults
			//		The range results, extended with iterative methods.
			// tag:
			//		Public

			var defer = this.store._waiting || this.store._loading;
			var paginate = false, index = this;

			assert.index(this, "getRange");
			assert.key(keyRange, "getRange");

			if (options) {
				if (isString(options)) {
					options = {direction: options};
				} else if (isObject(options)) {
					paginate = options.sort || options.start || options.count;
				} else {
					throw new StoreError("DataError", "getRange", "invalid options");
				}
			}

			var results = QueryResults(
				when(defer, function () {
					var objects = range.values(index, keyRange, options);
					if (paginate) {
						objects = sorter(objects, options);
					}
					return index.store._clone ? clone(objects) : objects;
				})
			);
			return results;
		};

		this.getKeyRange = function (keyRange, options) {
			// summary:
			//		Retrieve a range of store keys.
			// keyRange: Key|KeyRange?
			//		A KeyRange object or a valid key.
			// options: (String|Object)?
			//		If a string, the range required direction: 'next', 'nextunique',
			//		'prev' or 'prevunique'. Otherwise a Store.RangeOptions object.
			// returns: Store.QueryResults
			//		The range results, extended with iterative methods.
			// tag:
			//		Public

			var defer = this.store._waiting || this.store._loading;
			var index = this;

			assert.index(this, "getRange");
			assert.key(keyRange, "getKeyRange");

			if (options) {
				if (isString(options)) {
					options = {direction: options};
				}
			}

			var results = QueryResults(
				when(defer, function () {
					var objects = range.keys(index, keyRange, options);
					return index.store._clone ? clone(objects) : objects;
				})
			);
			return results;
		};

		this.openCursor = function (keyRange, direction) {
			// summary:
			//		Open a new cursor. A cursor is a transient mechanism used to iterate
			//		over multiple records in the store.
			// keyRange: Key|KeyRange?
			//		The key range to use as the cursor's range.
			// direction: String?
			//		The cursor's required direction.
			// returns: Cursor
			//		A cursorWithValue object.
			// example:
			//		| var cursor = store.openCursor();
			//		| while(cursor && cursor.value) {
			//		|       ...
			//		|     cursor.next();
			//		| };
			// tag:
			//		Public
			var dir = "next";

			assert.index(this, "openCursor");
			assert.key(keyRange, "openCursor");

			if (arguments.length > 1) {
				if (lib.isDirection(direction)) {
					dir = direction;
				} else {
					throw new StoreError("DataError", "openCursor");
				}
			}
			var cursor = new Cursor(this, keyRange, dir, false);
			return cursor;
		};

		this.openKeyCursor = function (keyRange, direction) {
			// summary:
			//		Open a new cursor. A cursor is a transient mechanism used to iterate
			//		over multiple records in the store.
			// keyRange: Key|KeyRange?
			//		The key range to use as the cursor's range.
			// direction: String?
			//		The cursor's required direction.
			// returns: Cursor
			//		A cursor Object.
			// example:
			//		| var cursor = store.openCursor();
			//		| while(cursor && cursor.value) {
			//		|       ...
			//		|     cursor.next();
			//		| };
			// tag:
			//		Public
			var dir = "next";

			assert.index(this, "openCursor");
			assert.key(keyRange, "openCursor");

			if (arguments.length > 1) {
				if (lib.isDirection(direction)) {
					dir = direction;
				} else {
					throw new StoreError("DataError", "openKeyCursor");
				}
			}
			var cursor = new Cursor(this, keyRange, dir, true);
			return cursor;
		};

		this.ready = function (callback, errback, scope) {
			// summary:
			//		Execute the callback when the store has been loaded. If an error
			//		is detected that will prevent the store from getting ready errback
			//		is called instead.
			// note:
			//		When the promise returned resolves it merely indicates one of
			//		potentially many load requests was successful. To keep track of
			//		a specific load request use the promise returned by the load()
			//		function instead.
			// callback: Function?
			//		Function called when the store is ready.
			// errback: Function?
			//		Function called when a condition was detected preventing the store
			//		from getting ready.
			// scope: Object?
			//		The scope/closure in which callback and errback are executed.
			// returns: dojo/promise/Promise
			//		dojo/promise/Promise
			// tag:
			//		Public
			if (callback || errback) {
				this._indexReady.then(
					callback ? callback.bind(scope) : null,
					errback  ? errback.bind(scope)  : null
				);
			}
			return this._indexReady.promise;
		};

		//=========================================================================
		var index = this;

		if (typeof name === "string" && keyPath && store) {

			// If keyPath is and Array and the multiEntry property is true throw an
			// exception of type NotSupportedError.
			if (keyPath instanceof Array && !!indexOptions.multiEntry) {
				var message = "KeyPath cannot be an array when multiEntry is enabled";
				throw new StoreError("NotSupportedError", "constructor", message);
			}
			// Initialize the event target with the store as the parent.
			EventTarget.call(this, store);

			// Protected properties
			this._directives = new Directives(this, indexDirectives, directives);
			this._indexReady = new Deferred();
			this._records    = [];
			this._updates    = 0;

			// Public properties.
			this.name        = name;
			this.keyPath     = keyPath;
			this.store       = store;
			this.baseClass   = "index";

			lib.readOnly(this, readOnly);
			lib.protect(this);

			store._register("loadEnd, loadStart", this._onLoadTrigger, this);

			this._indexReady.then(null, function (err) {
				var event = new Event("error", {error: err, bubbles: true});
				index.dispatchEvent(event);
			});
			if (this.async) {
				setTimeout(function () {
					indexStore(store, index, index._indexReady);
				}, 0);
			} else {
				indexStore(store, index, index._indexReady);
			}

		} else {
			throw new StoreError("SyntaxError", "constructor");
		}

	} /* end Index() */
	Index.prototype = new EventTarget();
	Index.prototype.constructor = Index;

	return Index;
});
