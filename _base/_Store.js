//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["require",
		"dojo/_base/declare",
		"dojo/Deferred",
		"dojo/when",
		"./FeatureList",
		"./Index",
		"./library",
		"./Keys",
		"./KeyRange",
		"./range",
		"../dom/event/Event",
		"../dom/event/EventTarget",
		"../dom/string/DOMStringList",
		"../error/createError!../error/StoreErrors.json",
		"../listener/ListenerList",
		"../transaction/_opcodes",
		"../util/QueryEngine",
		"../util/QueryResults",
		"../util/sorter"
		], function (require, declare, Deferred, when, FeatureList, Index, lib,
					Keys, KeyRange, recRange, Event, EventTarget, DOMStringList, createError,
					ListenerList, _opcodes, QueryEngine, QueryResults, sorter) {
	"use strict";
	// module:
	//		indexedStore/_base/_Store
	// summary:
	//		Abstract base class for the indexed store. This base class implements
	//		the majority of both the dojo/store/api/Store API and the IndexedDB
	//		IDBObjectStoreSync interface (http://www.w3.org/TR/IndexedDB/).
	//		Three additional base classes are provided to build a fully functional
	//		object store, they are:
	//
	//			1 - IndexedStore/_base/_Indexed
	//			2 - IndexedStore/_base/_Natural
	//			3 - IndexedStore/_base/_Loader
	//
	//		_Indexed class
	//			The base class _Indexed will organize all store records in a binary
	//			tree using the store keyPath property to extract the object key and
	//			build the tree accordingly. This type of store does NOT support the
	//			dojo/store/api/Store PutDirective property 'before'
	//
	//		_Natural class
	//			The base class _Natural will organize all store records in a natural
	//			order, that is, in the order the records are added to the store.
	//			This class provides support for the dojo/store/api/Store PutDirective
	//			property 'before' but does not support Cursors.
	//
	//		The _Indexed or _Natural base classes have no effect on the store's
	//		ability to create indexes, they merely determine the internal data
	//		structure. Indexes are handled separate from the object store itself.
	//
	//		In addition to the base classes the indexed store comes with a number
	//		of extensions which will allow you to enhance the store capabilities.
	//		Currently the following extensions are available:
	//
	//			- Hierarchy
	//			- Ancestry
	//			- CORS
	//			- Eventable
	//			- Loader
	//			- Observable
	//			- Watch
	//
	//		Hierarchy:
	//			The Hierarchy extension adds support for the dojo/store/api/Store
	//			PutDirective 'parent'. Both single and multi parented objects are
	//			supported. When the Hierarchy extension is applied the store will
	//			automatically get an index called 'parents'.
	//		Ancestry:
	//			The Ancestry extension is used in combination with the Hierarchy
	//			extension and allows for exploring the hierarchy in a store. This
	//			extension adds functions like: getDescendants(), getAncestors(),
	//			etc, etc.
	//		Eventable:
	//			The Eventable extension will cause the store to emit an event for
	//			any store mutation. An event is dispatched whenever an object is
	//			added to or removed from the store or when an existing object is
	//			updated.
	//		CORS:
	//			The CORS extension is used in combination with the Loader and adds
	//			Cross-Origin Resource Sharing (CORS) capabilities. When applied
	//			URL's with the schema http: or https: can be used.
	//		Loader:
	//			Extend the store with basic or advanced loading capabilities.
	//		Observable:
	//			Monitors for, and notifies the user of, changes to query or range
	//			results.
	//		Watch:
	//			Monitors store objects for changes to specific object properties.
	//			If an object property that is being monitored changes, the user
	//			specified handler(s) are notified and optionally a 'set' event is
	//			dispatched.
	//
	//		For detailed information on the bases classes and extensions please
	//		refer to the modules in either the store/_base or store/extension
	//		directory.
	//
	// IMPORTANT:
	//		In accordance with the http://www.w3.org/TR/IndexedDB/ specifications
	//		both _Indexed and _Natural based stores only give out cloned objects
	//		using the structured clone algorithm as specified by the HTML5 standard.
	//		Therefore, changes to objects only take effect AFTER an explicit put()
	//		operation. This behavior is different from the default dojo/store which
	//		handout object references. Consider the following example:
	//
	//		  var obj = store.get("something");
	//		  obj.change = true;
	//
	//		Because a dojo/store store uses object references, the above sequence
	//		will immediately alter the content of the store rendering any put()
	//		operation useless. The same sequence on an indexed store has NO effect
	//		on the store content until you explicitly write the information back
	//		to the store. The proper sequence would be:
	//
	//		  var obj = store.get("something");
	//		  obj.change = true;
	//		  store.put(obj);
	//
	// examples:
	//		To create the most basic functional store consider the following:
	//
	//	|	require(["dojo/_base/declare",
	//	|	         "store/_base/_Store",
	//	|	         "store/_base/_Indexed"
	//	|	        ], function (declare, _Store, _Indexed) {
	//	|	  var store = declare([_Store, _Indexed]);
	//	|	  var myStore = new store();
	//	|	});
	//
	//		To create a store that supports a hierarchy and can load data using a
	//		URL:
	//
	//	|	require(["dojo/_base/declare",
	//	|	         "store/_base/_Store",
	//	|	         "store/_base/_Indexed",
	//	|	         "store/_base/_Loader",
	//	|	         "store/extension/Hierarchy",
	//	|	        ], function (declare, _Store, _Indexed, _Loader, Hierarchy) {
	//	|	  var store = declare([_Store, _Indexed, _Loader, Hierarchy]);
	//	|	  var myStore = new store({url:"../data/Simpsons.json", keyPath:"name"});
	//	|	                       ...
	//	|	  var index  = store.index("parents");
	//	|	  var cursor = index.openCursor();
	//	|	  while (cursor && cursor.value) {
	//	|	    console.log("Parent name: " + cursor.primaryKey);
	//	|	    cursor.next();
	//	|	  }
	//	|	});
	//

	var StoreError  = createError("_Store");		// Create the StoreError type.
	var isDirection = lib.isDirection;
	var isObject    = lib.isObject;					// Test for [object Object];
	var isString    = lib.isString;
	var clone       = lib.clone;					// HTML5 structured clone.
	var mixin       = lib.mixin;

	var uniqueId = 0;

	function abstractOnly(method) {
		throw new StoreError("AbstractOnly", method);
	}

	var _Store = declare([EventTarget], {

		//=========================================================================
		// Constructor keyword arguments:

		// autoIncrement: Boolean
		//		If true, enables the store key generator.
		autoIncrement: false,

		// autoLoad: Boolean
		//		Indicates, when data or URL is specified, if the data should be loaded
		//		immediately (during store construction) or deferred until the user
		//		explicitly calls the store's load() method.
		autoLoad: true,

		// clearOnClose: Boolean
		//		If true, the store content will be deleted when the store is closed.
		clearOnClose: false,

		// data: Array
		//		The array of all raw objects to be loaded in the memory store. This
		//		property is only used during store construction.
		data: null,

		// defaultProperties: Object
		//		A JavaScript key:values pairs object whose properties and associated
		//		values are added to new store objects if such properties are missing
		//		from the new store object.
		defaultProperties: null,

		// idProperty: String
		//		The property name to use as the object identity property. The value of
		//		this property should be unique. If the object being added to the store
		//		does NOT have this property it will be added to the object.
		//		The idProperty is supported for dojo/store compatibility only, use
		//		keyPath instead.
		idProperty: "id",

		// indexes: Object|Object[]
		//		A JavaScript key:value pairs object defining an index
		//		index = { name: String, keyPath: KeyPath, options: Object? }
		indexes: null,

		// keyPath: String|String[]
		//		A key path is a DOMString or sequence<DOMString> that defines how to
		//		extract a key from an object.  A valid key path is either the empty
		//		string, a JavaScript identifier, or multiple Javascript identifiers
		//		separated by periods (.)
		//		(Note that spaces are not allowed within a key path)
		keyPath: null,

		// name: String?
		//		Name of the store. If omitted, one will be generated however, if you
		//		elect to use transactions it is recommended to provide a unique name
		//		for each store.
		name: "",

		// queryEngine: Function
		//		Defines the query engine to use for querying the data store.
		queryEngine: QueryEngine,

		// suppressEvents:
		//		Suppress the dispatching of events. Under certain circumstances it
		//		may be desirable to suppress the delivery of events. Both the base
		//		and extended loader will suppress event delivery while loading the
		//		store.
		suppressEvents: false,

		// uppercase: Boolean
		//		Indicates if the object key is to be stored in all uppercase chars.
		//		If true, all key string values are converted to uppercase before
		//		storing the record. The object property values used to compose the
		//		key are not affected.
		uppercase: false,

		// End constructor keyword
		//=========================================================================

		// features: FeatureList [READ-ONLY]
		features: null,

		// transaction: Transaction	[READ-ONLY]
		//		The transaction the store belongs to.
		transaction: null,

		// total: Number [read-only]
		//		The total number of objects currently in the store.
		total: 0,

		//=========================================================================
		// Constructor

		constructor: function (kwArgs) {
			// summary:
			//		Creates a generic indexed store.
			// kwArgs: Object?
			//		A JavaScript key:value pairs object
			//			{
			//				autoIncrement: Boolean?,
			//				autoLoad: Boolean?,
			//				clearOnClose: Boolean?,
			//				data: Object[]?
			//				defaultProperties: Object?
			//				idProperty: String?,
			//				indexes: (Object|Object[])?
			//				keyPath: String?,
			//				suppressEvents: Boolean?,
			//				uppercase: Boolean?
			//			}

			EventTarget.call(this);

			// Mixin the keyword arguments.
			declare.safeMixin(this, kwArgs);

			this._autoIndex  = 1;
			this._clone      = true;				// Handout only cloned objects
			this._indexes    = {};
			this._listeners  = new ListenerList();
			this._records    = [];
			this._storeReady = new Deferred();

			// NOTE: A keyPath value of null is allowed...
			if (kwArgs && kwArgs.keyPath !== undefined) {
				this.idProperty = kwArgs.keyPath;
			}
			this.features    = new FeatureList();
			this.indexNames  = new DOMStringList();
			this.keyPath     = this.idProperty;
			this.loader      = null;
			this.sid         = uniqueId++;
			this.name        = this.name || "store_" + this.sid;
			this.revision    = 1;		// Initial revision must be > 0 (See Observer).
			this.total       = 0;
			this.transaction = null;
			this.type        = "store";
			this.waiting     = this._storeReady.promise;

			if (this.keyPath != null && !Keys.validPath(this.keyPath)) {
				throw new StoreError("DataError", "constructor", "invalid keypath: '%{0}'", this.keyPath);
			}
			if (this.indexes) {
				if (!(this.indexes instanceof Array)) {
					this.indexes = [this.indexes];
				}
				this.indexes.forEach(function (index) {
					if (isObject(index)) {
						if (index.name && index.keyPath) {
							this.createIndex(index.name, index.keyPath, index.options);
						} else {
							throw new StoreError("PropertyMissing", "constructor", "property 'name' or 'keyPath' missing");
						}
					} else {
						throw new StoreError("DataError", "constructor", "index property is not a valid object");
					}
				}, this);
			}
			lib.defProp(this, "_emit", {value: function () {}, enumerable: false, configurable: true });
			lib.writable(this, "features, name, sid, type", false);
			lib.protect(this);	// Hide own protected properties.

			this.features.add("store");
		},

		postscript: function () {
			// summary:
			//		Called after all chained constructors have executed. At this point
			//		the store has been fully assembled.
			// tag:
			//		protected
			var store   = this;

			if (!this.features.has("indexed, natural")) {
				throw new StoreError("Dependency", "postscript", "base class _Indexed or _Natural required");
			}
			if (this.async) {
				var methods = ["add", "get", "put", "remove"];
				methods.forEach(function (method) {
					var func = this[method];
					this[method] = function () {
						var args = arguments;
						var prom = this._storeReady.then(function (store) {
							return func.apply(store, args);
						});
						if (this.cloned && this.transaction) {
							this.transaction._waitFor(prom);
						}
						return prom;
					};
				}, this);
			}

			if (this.loader) {
				// If the user specified a custom data handler go register it.
				if (this.loader && this.dataHandler) {
					require(["../handler/register"], function (register) {
						register(store.handleAs, store.dataHandler);
					});
				}
				if (this.autoLoad) {
					this.load();
				}
			} else {
				setTimeout(function () {
					store._storeReady.resolve(store);
				}, 0);
				store.waiting = false;
			}
		},

		//===================================================================
		// protected methods

		_applyDefaults: function (object) {
			// summary:
			//		 Add missing default properties.
			// object: Object
			//		Store object.
			// tag:
			//		protected
			var prop;

			for (prop in this.defaultProperties) {
				if (lib.getProp(prop, object) === undefined) {
					lib.setProp(prop, this.defaultProperties[prop], object);
				}
			}
		},

		_assertKey: function (key, method, required) {
			// summary:
			//		Assert key argument.
			// key: Key|KeyRange
			// method: String
			//		Name of the calling function.
			// required: Boolean?
			// tag:
			//		protected
			if (key != null) {
				if (!(key instanceof KeyRange) && !Keys.validKey(key)) {
					throw new StoreError("DataError", method, "invalid key specified");
				}
			} else if (required) {
				throw new StoreError("ParameterMissing", method, "key is a required argument");
			}
		},

		_assertStore: function (store, method, readWrite) {
			// summary:
			//		Assert store.  Validate if the store hasn't been destroyed or, when
			//		the store is part of a transaction, the transaction is still active
			//		and of the correct type.
			// store: Store
			//		Store to be asserted (this)
			// method: String
			//		Name of the calling function.
			// readWrite: Boolean?
			//		Indicates if the store operation requires read/write access.
			// tag:
			//		protected
			if (store.transaction) {
				if (!store.transaction.active) {
					throw new StoreError("TransactionInactive", method);
				}
				if (store.transaction.mode === "readonly" && readWrite) {
					throw new StoreError("ReadOnly", method);
				}
				if (!store.cloned) {
					throw new StoreError("AccessError", method, "no access allowed inside a transaction");
				}
			} else {
				if (store.cloned) {
					throw new StoreError("AccessError", method, "no access allowed outside a transaction");
				}
			}
			if (store._destroyed) {
				throw new StoreError("InvalidState", method, "store has been destroyed");
			}
		},

		_notify: function (opType, key, newVal, oldVal, oldRev, at, options) {
			// summary:
			//		Commit a store mutation. This method is called either directly from
			//		the store or, when in transaction mode, from the transaction when
			//		the transaction completed successfully.
			// opType:
			//		Operation type.
			// key: Key
			//		Record key.
			// newVal: any
			//		The new value property value of the store record.
			// oldVal: any
			//		The old value property value of the store record.
			// oldRev: Number
			//		The old revision number of the store record.
			// at: Number
			//		Record index number
			// options: Object?
			//		Operation directives
			// tag:
			//		protected
			var action, event;
			try {
				// If the operation was performed on a transactional (cloned) store add
				// the info to the transaction journal.
				if (this.cloned) {
					this.transaction._journal(this, arguments);
				}
				switch (opType) {
					case _opcodes.NEW:
					case _opcodes.UPDATE:
						this._trigger("write", key, newVal, oldVal, at, options);
						event = mixin({item: newVal}, (oldVal ? {oldItem: oldVal} : null));
						break;
					case _opcodes.DELETE:
						this._trigger("delete", key, null, oldVal, at);
						event = {item: oldVal};
						break;
				}
				if (event && this.eventable && !this.suppressEvents) {
					action = _opcodes.name(opType);
					event  = this._emit(action, event, true);
					if (event.error) {
						// An error was encountered in the user specified handler.
						// Although not an actual store error threat it as one as
						// it may be the only to get notified.
						throw event.error;
					}
				}
			} catch (err) {
				// Don't rely on _emit() being available, use dispatchEvent() instead.
				event = new Event("error", {error: err, bubbles: true, cancelable: true});
				this.dispatchEvent(event);
			}
		},

		_register: function (action, listener, scope) {
			// summary:
			//		Register a listener (callback) with the store. Registering callbacks
			//		with the store is reserved for store modules and extension only.
			// action: String|String[]
			//		Store action to register for. Action is one of the following:
			//			clear, close, delete, loadStart, loadCancel, loadEnd, loadFailed
			//			or write.
			//		The action argument can also be a comma separated string of action
			//		names.
			// listener: Listener|Function
			//		The listener that is called when the store action occurred.
			// scope: Object?
			//		The object use as 'this' in the listener body.
			// tag:
			//		protected
			return this._listeners.addListener(action, listener, scope);
		},

		_trigger: function (action /* [, arg0 [, arg1, ... , argN]] */) {
			// summary:
			//		Invoke the registered listeners for the given action.
			// action: String
			//		See _register()
			// tag:
			//		protected
			this._listeners.trigger.apply(this, arguments);
		},

		//===================================================================
		// IndexedDB procedures

		_clearRecords: function () {
			// summary:
			//		Remove all records from the store and all associated indexes.
			// tag:
			//		protected
			abstractOnly("_clearRecords");
		},

		_deleteKeyRange: function (key) {
			// summary:
			//		Remove all records from store whose key is in the key range.
			// key: Key|KeyRange
			//		Key identifying the record to be deleted. The key arguments can
			//		also be an KeyRange.
			// returns: Boolean
			//		true on successful completion otherwise false.
			// tag:
			//		protected

			abstractOnly("_deleteKeyRange");
		},

		_retrieveRecord: function (key) {
			// summary:
			//		Retrieve the first record from the store whose key matches
			//		key and return a Location object if found.
			// key: Key|KeyRange
			//		Key identifying the record to be retrieved. The key arguments
			//		can also be an KeyRange in which case the first record in range
			//		is returned.
			// returns: Location
			//		A location object. See indexedStore/_base/Location for details.
			// tag:
			//		protected

			abstractOnly("_retrieveRecord");
		},

		_storeRecord: function (value, options) {
			// summary:
			//		Add a record to the store. Throws a StoreError of type ConstraintError
			//		if the key already exists and directive overwrite is set to false.
			// value: Any
			//		Record value property
			// options: PutDirectives?
			//		Optional, PutDirectives
			// returns: Key
			//		Record key.
			// tag:
			//		protected

			abstractOnly("_storeRecord");
		},

		//=========================================================================
		// Public IndexedStore/api/store API methods

		add: function (object, options) {
			// summary:
			//		Add an object to the store. If an object with the same key already
			//		exists an exception of type ConstraintError is thrown.
			// object: Object
			//		The new object to store.
			// options: Store.PutDirectives?
			//		Additional metadata for storing the data.	Includes an "id" or "key"
			//		property if a specific key is to be used.
			// returns: Key
			//		A valid key
			// tag:
			//		Public

			this._assertStore(this, "add", true);
			if (object) {
				options = mixin(options, {overwrite: false});
				return this._storeRecord(object, options);
			}
			throw new StoreError("DataError", "add");
		},

		clear: function () {
			// summary:
			//		Remove all records from the the store and associated indexes.
			// tag:
			//		Public

			this._assertStore(this, "clear", true);
			this.loader && this.loader.cancel();
			this._clearRecords();
			this.revision++;

			this._trigger("clear");
			this._emit("clear");
		},

		close: function (clear) {
			// summary:
			//		Closes the store and optionally clear it.
			// clear: Boolean?
			//		If true, the store is reset. If not specified the store property
			//		'clearOnClose' is used instead.
			// tag:
			//		Public

			this._assertStore(this, "close", true);
			if (this._storeReady.isFulfilled()) {
				this._storeReady = new Deferred();
				this.waiting = this._storeReady.promise;
			}
			this._trigger("close");
			this._emit("close");
			if (!!(clear || this.clearOnClose)) {
				this.clear();
			}
		},

		count: function (key) {
			// summary:
			//		Count the total number of objects that share the key or key range.
			// key: Key|KeyRange
			//		Key identifying the record to be retrieved. The key arguments can
			//		also be an KeyRange.
			// returns:
			//		Total number of records matching the key or key range. If the key
			//		argument is omitted the total number of records in the store is
			//		returned.
			// tag:
			//		Public
			this._assertStore(this, "count");
			if (key != null) {
				return recRange(this, key).total;
			}
			return this.total;
		},

		createIndex: function (name, keyPath, options) {
			// summary:
			//		Create and returns a new index with the given name and parameters.
			//		If an index with the same name already exists, an exception of type
			//		ConstraintError is thrown.
			// name: DOMString
			//		The name of a new index.
			// keyPath: KeyPath
			//		The key path used by the new index.
			// options: Object?
			//		The options object whose attributes are optional parameters to this
			//		function. 'unique' specifies whether the index's unique flag is set.
			//		'multiEntry' specifies whether the index's multiEntry flag is set.
			// returns:
			//		An store Index object.
			// example:
			//	|	store.createIndex("authors", "author", {unique:false, multiEntry:false});
			// tag:
			//		Public
			this._assertStore(this, "createIndex", true);
			if (name && keyPath) {
				if (!this.indexNames.contains(name)) {
					var index = new Index(this, name, keyPath, options);
					index.ready(function (index) {
						var indexNames = this.indexNames.toArray();
						indexNames.push(name);
						this.indexNames = new DOMStringList(indexNames);
						this._indexes[name] = index;
						this._notify(_opcodes.CREATE_INDEX);
					}, null, this);
					return index;
				}
				throw new StoreError("ConstraintError", "createIndex", "index with name %{0} already exist", name);
			}
			throw new StoreError("DataError", "createIndex", "name or key path missing");
		},

		deleteIndex: function (name) {
			// summary:
			//		Destroy the index with the given name.
			// name: DOMString
			//		The name of an existing index.
			// tag:
			//		Public
			this._assertStore(this, "deleteIndex", true);
			var index = this._indexes[name];
			if (index) {
				delete this._indexes[name];
				this.indexNames = new DOMStringList(Object.keys(this._indexes));
				index._destroy();
				this._notify(_opcodes.DELETE_INDEX);
			} else {
				throw new StoreError("NotFound", "deleteIndex", "index with name %{0} does not exist", name);
			}
		},

		destroy: function () {
			// summary:
			//		Release all memory, including all indexed, and mark the store as
			//		destroyed.
			// tag:
			//		Public
			var name;

			this._clearRecords();
			// Destroy all indexes.
			for (name in this._indexes) {
				this.deleteIndex(name);
			}
			this._destroyed = true;
			this._listeners.removeListener();			// Remove all listeners...
			this._indexes   = {};
			this.indexNames = null;
		},

		get: function (key) {
			// summary:
			//		Retrieves an object by its key
			// key: Key|KeyRange
			//		Key identifying the record to be retrieved.   This can also be a
			//		KeyRange in which case the function retreives the first existing
			//		object in that range.
			// returns: Object|undefined
			//		The object in the store that matches the given key. If no such key
			//		exists undefined is returned.
			// tag:
			//		Public
			this._assertStore(this, "get", false);
			this._assertKey(key, "get", true);
			var record = this._retrieveRecord(key).record;
			if (record) {
				return (this._clone ? clone(record.value) : record.value);
			}
		},

		getIdentity: function (object) {
			// summary:
			//		Returns an object's identity (key).  Note that if object is not an
			//		existing store object the key returned may not be a valid key!
			// object: Object
			//		The object to get the identity from
			// returns: Key
			//		Key value or undefined in case the store has no key path.
			// tag:
			//		Public
			if (this.keyPath) {
				return Keys.keyValue(this.keyPath, object, this.uppercase);
			}
		},

		getMetadata: function (item) {
			// summary:
			//		Returns any metadata about the object. Currently only the object's
			//		key and property names are returned, that is, if the object exists
			//		in the store.
			// item: Key|Object
			// returns: Object
			// tag:
			//		public
			this._assertStore(this, "getMetadata", false);
			var key = isObject(item) ? this.getIdentity(item) : item;
			if (key) {
				var record = this._retrieveRecord(key).record;
				if (record) {
					var meta = {key: key, properties: Object.keys(record.value),
								revision: record.rev, stale: record.stale};
					return meta;
				}
			}
		},

		getRange: function (keyRange, options) {
			// summary:
			//		Retrieve a range of store records.
			// keyRange: Key|KeyRange?
			//		A KeyRange object or valid key.
			// options: (String|Store.RangeOptions)?
			//		If a string, the range required direction: 'next', 'nextunique',
			//		'prev' or 'prevunique'. Otherwise a Store.RangeOptions object.
			// returns: Store.QueryResults
			//		The results of the range, extended with iterative methods.
			// tag:
			//		Public
			this._assertStore(this, "getRange", false);

			var direction = "next", keysOnly = false, paginate = false;
			var defer = this.waiting || (this.loader && this.loader.loading);
			var results, store = this;

			if (options) {
				if (isString(options)) {
					direction = options;
				} else if (isObject(options)) {
					direction = options.direction || direction;
					paginate  = options.sort || options.start || options.count;
					keysOnly  = !!options.keysOnly;
				} else {
					throw new StoreError("DataError", "getRange", "invalid options");
				}
			}
			if (!isDirection(direction)) {
				throw new StoreError("DataError", "getRange", "invalid direction");
			}

			results = QueryResults(
				when(defer, function () {
					var objects = recRange(store, keyRange, direction, false, keysOnly);
					if (paginate) {
						objects = sorter(objects, options);
					}
					return store._clone ? clone(objects) : objects;
				})
			);
			return results;
		},

		index: function (name) {
			// summary:
			//		Returns an Index object representing an index that is part of the
			//		store.
			// name: DOMString
			//		The name of an existing index.
			// returns: Object
			//		An Index object or undefined
			// tag:
			//		Public
			var index = this._indexes[name];
			if (index) {
				return index;
			}
		},

		put: function (object, options) {
			// summary:
			//		Stores an object
			// object: Object
			//		The value to be stored in the record.
			// options: Store.PutDirectives?
			//		Additional metadata for storing the data.
			// returns: Key
			//		A valid key.
			// tag:
			//		Public
			this._assertStore(this, "put", true);
			if (object) {
				options = mixin({overwrite: true}, options);
				return this._storeRecord(object, options);
			}
			throw new StoreError("DataError", "put");
		},

		query: function (query, options) {
			// summary:
			//		Queries the store for objects. The query executes asynchronously if,
			//		and only if, the store is not ready or a load request is currently
			//		in progress.
			// query: Object?
			//		The query to use for retrieving objects from the store.
			// options: Store.QueryOptions?
			//		The optional directives apply to the resultset.
			// returns: Store.QueryResults
			//		The results of the query, extended with iterative methods.
			// tag:
			//		Public

			var defer = this.waiting || (this.loading && this.loader.loading);
			var store = this;

			var results = QueryResults(
				when(defer, function () {
					var objects = store.queryEngine(query, options)(store._records);
					return store._clone ? clone(objects) : objects;
				})
			);
			return results;
		},

		ready: function (callback, errback, progress, scope) {
			// summary:
			//		Execute the callback when the store has finished loading or entered
			//		the ready state. If an error is detected that will prevent the store
			//		from getting ready errback is called instead.
			// callback: Function?
			//		Function called when the store is ready.
			// errback: Function?
			//		Function called when a condition was detected preventing the store
			//		from getting ready.
			// progress: Function?
			// scope: Object?
			//		The scope/closure in which callback and errback are executed. If
			//		not specified the store is used.
			// returns: dojo/promise/Promise
			//		dojo/promise/Promise
			// NOTE:
			//		When the promise returned resolves it merely indicates one of
			//		potentially many load requests was successful. To keep track of
			//		a specific load request use the promise returned by the load()
			//		function instead. (See Load() for details).
			// tag:
			//		Public
			if (callback || errback || progress) {
				this._storeReady.then(
					callback ? callback.bind(scope) : null,
					errback  ? errback.bind(scope)  : null,
					progress ? progress.bind(scope) : null
				);
			}
			return this._storeReady.promise;
		},

		remove: function (key) {
			// summary:
			//		Delete object(s) by their key
			// key: Key|KeyRange
			//		The key or key range identifying the record(s) to be deleted. If
			//		a key range, all records within the range will be deleted.
			// returns: Boolean
			//		Returns true if an object was removed otherwise false.
			// tag:
			//		Public
			this._assertStore(this, "remove", true);
			this._assertKey(key, "remove", true);
			return this._deleteKeyRange(key);
		},

		toString: function () {
			return "[object Store]";
		}
	});	/* end declare() */
	return _Store;
});	/* end define() */
