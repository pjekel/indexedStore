//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["require",
				"dojo/_base/declare",
				"dojo/Deferred",
				"dojo/when",
				"./FeatureList",
				"./Index",
				"./Library",
				"./LoaderBase",
				"./Keys",
				"./KeyRange",
				"./Range",
				"./Record",
				"./Transaction",
				"../error/createError!../error/StoreErrors.json",
				"../dom/event/EventTarget",
				"../dom/string/DOMStringList",
				"../listener/ListenerList",
				"../util/QueryEngine",
				"../util/QueryResults",
				"../util/Sorter"
			 ], function (require, declare, Deferred, when, FeatureList, Index, Lib, Loader, 
			               Keys, KeyRange, Range, Record, Transaction, createError, 
			               EventTarget, DOMStringList, ListenerList, QueryEngine,
			               QueryResults, Sorter ) {
	"use strict";
	// module:
	//		IndexedStore/_base/_Store
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
	//		_Loader:
	//			The _Loader class adds the ability to load the store with retrieved
	//			using a URL. In addition, it adds support for custom data handlers.
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
	//		CORS:
	//			The CORS extension is used in combination with the Loader and adds
	//			Cross-Origin Resource Sharing (CORS) capabilities. When applied
	//			URL's with the schema http: or https: can be used.
	//		Observable:
	//			Monitors for, and Notifies the user, of changes to query or range
	//			results.
	//		Watch:
	//			Monitors store objects for changes to specific object properties.
	//			If an object property that is being monitored changes a set event
	//			is dispatched.
	//
	//		For detailed information on the bases classes and extensions please
	//		refer to the modules in either the store/_base or store/extension
	//		directories.
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
	//			obj.change = true;
	//		
	//		Because a dojo/store store uses object references, the above sequence
	//		will immediately alter the content of the store rendering any put()
	//		operation useless. The same sequence on an indexed store has NO effect
	//		on the store content until you explicitly write the information back
	//		to the store. The proper sequence would be:
	//
	//		  var obj = store.get("something");
	//			obj.change = true;
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
	//	|	  var myStore = new store( {url:"../data/Simpsons.json", keyPath:"name"} );
	//	|	                       ...
	//	|	  var index  = store.index("parents");
	//	|	  var cursor = index.openCursor();
	//	|	  while (cursor && cursor.value) {
	//	|	    console.log( "Parent name: " + cursor.primaryKey );
	//	|	    cursor.cont();
	//	|	  } 
	//	|	});
	//

	var StoreError  = createError( "_Store" );		// Create the StoreError type.
	var isDirection = Lib.isDirection; 
	var isObject    = Lib.isObject;								// Test for [object Object];
	var isString    = Lib.isString;
	var clone       = Lib.clone;									// HTML5 structured clone.
	var mixin       = Lib.mixin;

	var opTypes  = ["new", "delete", "update"];
	var uniqueId = 0;
	var undef;
	
	function AbstractOnly (/*String*/ method) {
		throw new StoreError("AbstractOnly", method );
	}
	
	var _Store = declare( [EventTarget], {

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
			declare.safeMixin( this, kwArgs );

			this._autoIndex  = 1;
			this._clone      = true;						// Handout only cloned objects
			this._indexes    = {};
			this._listeners  = new ListenerList();
			this._records    = [];
			this._storeReady = new Deferred();

			// NOTE: A keyPath value of null is allowed...
			if (kwArgs && "keyPath"in kwArgs) {
				this.idProperty = kwArgs.keyPath;
			}
			this.features    = new FeatureList();
			this.indexNames  = new DOMStringList();
			this.keyPath     = this.idProperty;
			this.loader      = new Loader(this);
			this.sid         = uniqueId++;
			this.name        = this.name || "store_" + this.sid;
			this.revision    = 1;			// Initial revision must be > 0 (See Observer).
			this.total       = 0;
			this.transaction = null;
			this.type        = "store";
			this.waiting     = this._storeReady.promise;

			if (this.keyPath != undef && !Keys.validPath(this.keyPath)) {
				throw new StoreError( "DataError", "constructor", "invalid keypath: '%{0}'", this.keyPath );
			}
			
			var indexes = this.indexes;
			if (indexes) {
				if (!(indexes instanceof Array)) {
					indexes = [indexes];
				}
				indexes.forEach( function (index) {
					if (isObject(index)) {
						if (index.name && index.keyPath) {
							this.createIndex( index.name, index.keyPath, index.options );
						} else {
							throw new StoreError( "PropertyMissing", "constructor", "property 'name' or 'keyPath' missing" );
						}
					} else {
						throw new StoreError( "DataError", "constructor", "index property is not a valid object" );
					}
				}, this);
			}
			Lib.defProp( this, "_emit", {value: function () {}, enumerable: false, configurable: true });
			Lib.writable( this, "features, name, sid, type", false );
			Lib.protect( this );	// Hide own private properties.

			this.features.add("store");
		},

		postscript: function (kwArgs) {
			// summary:
			//		Called after all chained constructors have executed. At this point
			//		the store has been fully assembled.
			// kwArg: Object
			//		See constructor()
			// tag:
			//		Private

			if (this.async) {
				var methods = ["add", "get", "put", "remove"];
				methods.forEach( function (method) {
					var func = this[method];
					this[method] = function () {
						var args = arguments;
						return this._storeReady.then( function (store) {
							return func.apply(store, args);
						});
					} 
				}, this );
			}

			// If LoaderPlus is not installed use the default loader.
			if (!this.features.has("loader")) {
				if (this.autoLoad) {
					this.load();
				}
			}
		},

		//===================================================================
		// Private methods
		
		_applyDefaults: function (object) {
			// summary:
			//		 Add missing default properties.
			// object: Object
			//		Store object.
			// tag:
			//		Private
			var prop;
			
			for (prop in this.defaultProperties) {
				if (Lib.getProp(prop, object) == undef) {
					Lib.setProp(prop, this.defaultProperties[prop], object);
				}
			}
		},

		_assertKey: function (key, method, required ) {
			// summary:
			//		Assert key argument.
			// key: Key|KeyRange
			// method: String
			//		Name of the calling function.
			// required: Boolean?
			// tag:
			//		Private
			if (key != undef) {
				if (!(key instanceof KeyRange) && !Keys.validKey(key)) {
					throw new StoreError( "DataError", method, "invalid key specified");
				}
			} else if (required) {
					throw new StoreError( "ParameterMissing", method, "key is a required argument");
			}
		},
		
		_assertStore: function (store, method, readWrite ) {
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
			//		Private
			if (store._destroyed) {
				throw new StoreError( "InvalidState", method, "store has been destroyed");
			} else if (readWrite) {
				if (store.transaction) {
					if (!store.transaction.active) {
						throw new StoreError( "TransactionInactive", method);
					}
					if (store.transaction.mode == "readonly") {
						throw new StoreError( "ReadOnly", method);
					}
				}
			}
		},

		_commit: function (opType, key, newVal, oldVal, oldRev, at, options) {
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
			//		private
			var action = opTypes[opType];
			var event;
			
			try {
				switch (opType) {
					case Transaction.NEW:
					case Transaction.UPDATE:
						this._trigger("write", key, newVal, oldVal, at, options );
						event = mixin ({item: newVal}, (oldVal ? {oldItem: oldVal} : null));
						break;
					case Transaction.DELETE:
						this._trigger("delete", key, null, oldVal, at );
						event = {item: oldVal};
						break;
				}
				if (this.eventable && !this.suppressEvents) {
					this._emit( action, event, true);
				}
			} catch (err) {
				throw StoreError.call(err, err, "_commit" );
			}
		},

		_register: function ( action, listener, scope ) {
			// summary:
			//		Register a listener (callback) with the store. Registering callbacks
			//		with the store is reserved for store modules and extension only.
			// action: String
			//		Store action to register for. Action is one of the following:
			//			clear, close, delete, loadStart, loadCancel, loadEnd, loadFailed
			//			or write.
			// listener: Listener|Function
			// scope: Object?
			// tag:
			//		private
			return this._listeners.addListener( action, listener, scope );
		},

		_trigger: function (action /* [, arg0 [, arg1, ... , argN]] */ ) {
			// summary:
			//		Invoke the registered listeners.
			// action: String
			//		See _register()
			// tag:
			//		private
			this._listeners.trigger.apply(this, arguments);
		},

		//===================================================================
		// IndexedDB procedures

		_clearRecords: function () {
			// summary:
			//		Remove all records from the store and all associated indexes.
			// tag:
			//		Private
			AbstractOnly("_clearRecords");
		},

		_deleteKeyRange: function ( key ) {
			// summary:
			//		Remove all records from store whose key is in the key range.
			// key: Key|KeyRange
			//		Key identifying the record to be deleted. The key arguments can also
			//		be an KeyRange.
			// returns: Boolean
			//		true on successful completion otherwise false.
			// tag:
			//		Private

			AbstractOnly("_deleteKeyRange");
		},

		_retrieveRecord: function ( key ) {
			// summary:
			//		Retrieve the first record from the store whose key matches key and
			//		return a locator object if found.
			// key: Key|KeyRange
			//		Key identifying the record to be retrieved. The key arguments can also
			//		be an KeyRange in which case the first record in range is returned.
			// returns: Location
			//		A location object. (see the ./util/Keys module for detais).
			// tag:
			//		Private

			AbstractOnly("_retrieveRecord");
		},

		_storeRecord: function (value, options ) {
			// summary:
			//		Add a record to the store. Throws a StoreError of type ConstraintError
			//		if the key already exists and noOverwrite is set to true.
			// value: Any
			//		Record value property
			// options: PutDirectives?
			//		Optional, PutDirectives
			// returns: Key
			//		Record key.
			// tag:
			//		Private

			AbstractOnly("_storeRecord");
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

			if (object) {
				this._assertStore( this, "add", true );
				options = mixin( options, {overwrite: false} );
				return this._storeRecord( object, options );
			}
			throw new StoreError( "DataError", "add" );
		},

		clear: function () {
			// summary:
			//		Remove all records from the the store and associated indexes.
			// tag:
			//		Public
			
			this._assertStore( this, "clear", true );
			this.loader.cancel();
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

			this._assertStore( this, "close", true );
			if (this._storeReady.isFulfilled()) {
				this._storeReady = new Deferred();
				this.waiting = this._storeReady.promise;
			}
			this._trigger("close");
			this._emit( "close" );
			if ( !!(clear || this.clearOnClose) ) {
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

			AbstractOnly("count");
		},
		
		createIndex: function (name, keyPath, options ) {
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
			this._assertStore( this, "createIndex", true );
			if (name && keyPath) {
				if (!this.indexNames.contains(name)) {
					var index = new Index(this, name, keyPath, options);
					index.ready( function (index) {
						var indexNames = this.indexNames.toArray();
						indexNames.push(name);
						this.indexNames = new DOMStringList(indexNames);
						this._indexes[name] = index;
					}, null, this)
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
			var index = this._indexes[name];
			var names;
			
			if (index) {
				delete this._indexes[name];
				this.indexNames = new DOMStringList( Object.keys(this._indexes) );
				index._destroy();
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
			var name, index;

			this._assertStore( this, "destroy", true );
			this._destroyed = true;
			this._clearRecords();
			// Destroy all indexes.
			for(name in this._indexes) {
				this.deleteIndex(name);
			}
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
			this._assertStore( this, "get", false );
			this._assertKey( key, "get", true );
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
				var key = Keys.keyValue(this.keyPath, object);
				return this.uppercase ? Keys.toUpperCase(key) : key;
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
			this._assertStore( this, "getMetadata", false );
			var key = isObject(item) ? this.getIdentity(object) : item;
			if (key) {
				var record = this._retrieveRecord(key).record;
				if (record) {
					var meta = {key: key, properties: Object.keys(record.value)};
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

			var direction = "next", paginate = false, range = keyRange;
			var defer = this.waiting || this.loader.loading;
			var store = this;

			if (options) {
				if (isString(options)) {
					direction = options;
				} else if (isObject(options)) {
					direction = options.direction || direction;
					paginate  = options.sort || options.start || options.count;
				} else {
					throw new StoreError("DataError", "getRange", "invalid options");
				}
			}
			if (!isDirection(direction)) {
				throw new StoreError("DataError", "getRange", "invalid direction");
			}

			var results = QueryResults ( 
				when (defer, function () {
					var objects = Range( store, range, direction, false, false );
					if (paginate) {
						objects = Sorter(objects, options);
					}
					return store._clone ? clone(objects) : objects;
				})
			);
			return results;
		},

		index: function (name){
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
		
		load: function (options) {
			// summary:
			//		Load a set of objects into the store.
			// options: LoadDirectives?
			//		LoadDirectives, see (indexedStore/_base/LoaderXXX for details).
			// returns: dojo/promise/Promise
			//		dojo/promise/Promise
			// example:
			//	|	store.load( {data: myObjects, overwrite: true} );
			// tag:
			//		public

			// If the initial load request failed, reset _storeReady to allow for
			// another attempt.
			if (this._storeReady.isRejected()) {
				this._storeReady = new Deferred();
				this.waiting     = this._storeReady.promise;
			}

			var directives = {
				data: this.data,
				overwrite: !!this.overwrite
			};
			var options  = mixin( directives, options);
			var suppress = this.suppressEvents;
			var store    = this;
			var promise;
			
			this.suppressEvents = true;
			promise = this.loader.load(options);
			promise.always( function () {
				store.suppressEvents = suppress;
				store.data = null;
			});
			promise.then( 
				function () {
					setTimeout( function () {
						store._emit( "load" );
						store._storeReady.resolve(store);
					}, 0);
					store.waiting = false;
				},
				store._storeReady.reject
			);
			return promise;
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
			if (object) {
				this._assertStore( this, "put", true );
				options = mixin( {overwrite: true}, options );
				return this._storeRecord( object, options );
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

			var defer = this.waiting || this.loader.loading;
			var store = this;

			var results = QueryResults ( 
				when (defer, function () {
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

this._emit("error", {error:"it's a store error"});

			this._assertStore( this, "remove", true );
			this._assertKey( key, "remove", true );
			return this._deleteKeyRange(key);
		},
		
		setData: function (data) {
			// summary:
			//		Clear the store and load the data. This method is provided for
			//		dojo/store/Memory compatibility only (See also load())
			// data: Object[]?
			//		An array of objects.
			// tag:
			//		Public
			this.data = data;
			this.clear();
			this.load();
		}
		
	});	/* end declare() */
	
	return _Store;

});	/* end define() */
