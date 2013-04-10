//
// Copyright (c) 2012-2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following three licenses:
//
//	1 - BSD 2-Clause								(http://thejekels.com/cbtree/LICENSE)
//	2 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	3 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/declare",
				"dojo/_base/lang",
				"dojo/Deferred",
				"dojo/Stateful",
				"dojo/store/util/QueryResults",
				"./FeatureList",
				"./Index",
				"./Library",
				"./Location",
				"./Keys",
				"./KeyRange",
				"./Record",
				"../error/createError!../error/StoreErrors.json",
				"../dom/event/Event",
				"../dom/event/EventTarget",
				"../dom/string/DOMStringList",
				"../util/QueryEngine",
				"../util/shim/Array"						 // ECMA-262 Array shim
			 ], function (declare, lang, Deferred, Stateful, QueryResults, 
			               FeatureList, Index, Lib, Location, Keys, KeyRange, Record,
			               createError, 
			               Event, EventTarget, 
			               DOMStringList, QueryEngine ) {
	"use strict";
	// module:
	//		store/_base/_Store
	// summary:
	//		Abstract base class for the indexed store. This base class implements
	//		the majority of both the dojo/store/api/Store API and the IndexedDB
	//		IDBObjectStoreSync interface (http://www.w3.org/TR/IndexedDB/).
	//		Two additional base classes are provided to build a fully functional
	//		object store, they are:
	//
	//			1 - store/_base/_Indexed
	//			2 - store/_base/_Natural
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
	//			property 'before' but does not support cursors, only the query engine.
	// 
	//		The _Indexed or _Natural base classes have no effect on the store's
	//		ability to create indexes, they merely determine the internal data
	//		structure. Indexes are handled separate from the object store itself.
	//
	//		In addition to the base classes the indexed store comes with a number
	//		of extensions which will allow you to enhance the store capabilities.
	//		Currently the following extensions are available:
	//
	//			- Loader
	//			- Hierarchy
	//			- Ancestry
	//			- CORS
	//
	//		Loader:
	//			The loader extension adds the ability to load the store with either
	//			in memory objects or objects retrieved using a URL. In addition, it
	//			adds support for custom data handlers.
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
	//	|	         "store/extension/Loader",
	//	|	         "store/extension/Hierarchy",
	//	|	        ], function (declare, _Store, _Indexed, Loader, Hierarchy) {
	//	|	  var store = declare([_Store, _Indexed, Loader, Hierarchy]);
	//	|	  var myStore = new store( {url:"../data/Simpsons.json", keyPath:"name"} );
	//	|	                       ...
	//	|	  var index  = store.index("parents");
	//	|	  var cursor = index.openCursor();
	//	|	  while (cursor && cursor.value) {
	//	|	    console.log( "Parent name: " + cursor.primaryKey );
	//	|	    cursor.continue();
	//	|	  } 
	//	|	});
	//

	var defineProperty = Object.defineProperty
	var StoreError = createError( "_Store" );			// Create the StoreError type.
	var isObject   = Lib.isObject;								// Test for [object Object];
	var clone      = Lib.clone;										// HTML5 structured clone.
	var uniqueId   = 0;
	var undef;
	
	function AbstractOnly (/*String*/ method) {
		throw new StoreError("AbstractOnly", method );
	}
	
	var _Store = {

		//=========================================================================
		// Constructor keyword arguments:

		autoIncrement: false,
		
		// clearOnClose: Boolean
		//		If true, the store content will be deleted when the store is closed.
		clearOnClose: false,
		
		// defaultProperties: Object
		//		A JavaScript key:values pairs object whose properties and associated
		//		values are added to new store objects if such properties are missing
		//		from the new store object.
		defaultProperties: null,

		// idProperty: String
		//		The property name to use as the object identity property. The value of
		//		this property should be unique. If the object being added to the store
		//		does NOT have this property it will be added to the object.
		idProperty: "id",

		indexes: null,

		// keyPath: String|String[]
		//		A key path is a DOMString that defines how to extract a key from an
		//		object. A valid key path is either the empty string, a JavaScript
		//		identifier, or multiple Javascript identifiers separated by periods (.)
		//		(Note that spaces are not allowed within a key path.)
		//		In addition, the keyPath property can also be an array of key paths.
		keyPath: null,

		// name: String?
		//		Name of the store. If omitted, one will be generated however, if you
		//		elect to use transactions it is recommended to provide a unique name
		//		for each store.
		name: "",
		
		// queryEngine: Function
		//		Defines the query engine to use for querying the data store
		queryEngine: QueryEngine,

		// suppressEvents:
		//		Suppress the dispatching of events. Under certain circumstances it
		//		may be desirable to to suppress the delivery of events until, for
		//		example, after a load request has finished. 
		suppressEvents: false,
		
		// transaction: Transaction	[READ-ONLY]
		//		The transaction the store belongs to.
		transaction: null,
		
		// uppercase: Boolean
		//		Indicates if the object key is to be stored in all uppercase chars.
		//		If true, all key string values are converted to uppercase before
		//		storing the record. The object properties used to extract the key
		//		are not effected.  Beyond storage, the store does NOT perform any
		//		automatic key conversion on API parameters. 
		uppercase: false,
		
		// End constructor keyword
		//=========================================================================
		
		// features: FeatureList [READ-ONLY]
		features: null,
		
		// total: Number [read-only]
		//		The total number of objects currently in the store.
		total: 0,

		//=========================================================================
		// Constructor

		constructor: function (/*Object*/ kwArgs) {
			// summary:
			//		Creates a generic indexed store.
			// kwArgs:
			//		A JavaScript key:value pairs object
			//			{
			//				autoIncrement: Boolean?,
			//				clearOnClose: Boolean?,
			//				defaultProperties: Object?
			//				idProperty: String?,
			//				keyPath: String?,
			//				suppressEvents: Boolean?
			//			}

			// Mixin the keyword arguments.
			declare.safeMixin( this, kwArgs );

			this._autoIndex  = 1;
			this._clone      = true;		// Only handout cloned objects
			this._indexes    = {};
			this._index      = {};			// Local record index (used by _Natural only).
			this._records    = [];
			this._storeReady = new Deferred();

			this.features    = new FeatureList();
			this.indexNames  = new DOMStringList();
			this.idProperty  = this.keyPath || this.idProperty;
			this.keyPath     = this.idProperty;
			this.total       = 0;
			this.transaction = null;
			this.type        = "store";

			if (!this.name) {
				this.name = "store_" + uniqueId++;
			}

			Lib.writable( this, "type", false );
			Lib.protect( this );	// Hide own private properties.

			this._storeIsReady( this );
		},

		//=========================================================================
		// Getters & Setters (see Stateful.js)

		_idPropertySetter: function (keyPath) {
			// summary:
			// tag:
			//		Private
			this._keyPathSetter(keyPath);
		},

		_indexesSetter: function (indexes) {
			// summary:
			// indexes:
			// tag:
			//		Private
			if (indexes) {
				if (!(indexes instanceof Array)) {
					indexes = [indexes];
				}
				indexes.forEach( function (index) {
					if (isObject(index)) {
						if (index.name && index.keyPath) {
							this.createIndex( index.name, index.keyPath, index.options );
						} else {
							throw new StoreError( "PropertyMissing", "indexSetter", "Required property 'name' or 'keyPath' missing" );
						}
					} else {
						throw new StoreError( "TypeError", "indexSetter", "index property is not a valid object" );
					}
				}, this);
			}
		},
		
		_keyPathSetter: function (keyPath ) {
			// summary:
			// keyPath:
			// tag:
			//		Private
			if (keyPath !== null && !Keys.validPath(keyPath)) {
				throw new StoreError( "TypeError", "keyPathSetter", "invalid keypath: '%{0}'", keyPath );
			}
			this.idProperty = this.keyPath = keyPath;
		},

		_suppressEventsSetter: function (value) {
			// summary:
			//		Enable or disable the dispatching of store events.
			// value:
			//		Boolean true or false
			// tag:
			//		Private
			if (value != undef) {
				this.suppressEvents = !!value;
			}
		},

		//===================================================================
		// Common procedures
		
		_assertKey: function (/*Key|KeyRange*/ key,/*String*/ method,/*Boolean?*/ required ) {
			// summary:
			// key:
			// method:
			//		Name of the calling function.
			// required:
			// tag:
			//		Private
			if (key != undef) {
				if (!key instanceof KeyRange && !Keys.validKey(key)) {
					throw new StoreError( "DataError", method, "invalid key specified");
				}
			} else {
				if (required) {
					throw new StoreError( "ParameterMissing", method, "key is a required argument");
				}
			}
		},
		
		_assertStore: function (/*Store*/ store,/*String*/ method,/*Boolean?*/ readWrite ) {
			// summary:
			// store:
			//		Store to be asserted (this)
			// method:
			//		Name of the calling function.
			// readWrite:
			//		
			// tag:
			//		Private
			if (store._destroyed) {
				throw new StoreError( "InvalidState", method, "store has been destroyed");
			} else if (readWrite) {
				if (store.transaction && store.transaction.mode == "readonly") {
					throw new StoreError( "ReadOnly", method);
				}
			}
		},

		_anyToObject: function (any) {
			// summary:
			// any:
			// returns:
			//		An object
			// tag:
			//		Private
			var location = this._anyToRecord(any);
			if (location.record) {
				return location.record.value;
			}
		},
		
		_anyToRecord: function (any) {
			// summary:
			// any:
			// returns:
			//		A location object
			// tag:
			//		Private
			var key = any;
			if (any) {
				if (isObject(any)) {
					key = this.getIdentity(any);
				}
				return this._retrieveRecord( key );				
			}
			// If 'any' is nothing than return the end of the array.
			return new Location( this, this._records.length-1, -1, this._records.length );
		},
		
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

		_deleteKeyRange: function (/*any*/ key ) {
			// summary:
			//		Remove all records from store whose key is in the key range.
			// key:
			//		Key identifying the record to be deleted. The key arguments can also
			//		be an KeyRange.
			// returns:
			//		true on successful completion otherwise false.
			// tag:
			//		Private

			AbstractOnly("_deleteKeyRange");
		},

		_deleteRecord: function (/*Record*/ record, /*Number*/ recNum ) {
			// summary:
			//		Delete a single record from the store.
			// recnum:
			//		Record number (index).
			// returns:
			//		true on successful completion otherwise false
			// tag:
			//		Private

			AbstractOnly("_deleteRecord");
		},

		_indexRecord: function (/*Record*/ record,/*Number?*/ recNum) {
			// summary:
			//		Add the record to each store index. If any of the indexes throws an
			//		exception reverse the index operation and re-throw the error.
			// record:
			//		Record to index.
			// recNum:
			//		record number.
			// tag:
			//		Private

			AbstractOnly("_indexRecord");
		},

		_retrieveRecord: function (/*any*/ key ) {
			// summary:
			//		Retrieve the first record from the store whose key matches key and
			//		return a locator object if found.
			// key:
			//		Key identifying the record to be retrieved. The key arguments can also
			//		be an KeyRange in which case the first record in range is returned.
			// returns:
			//		A location object. (see the ./util/Keys module for detais).
			// tag:
			//		Private

			AbstractOnly("_retrieveRecord");
		},

		_storeRecord: function (/*any*/ value,/*PutDirectives*/ options,/*Function?*/ callback ) {
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

			AbstractOnly("_storeRecord");
		},

		//=========================================================================
		// Private methods

		_storeIsReady: function (result) {
			// summary:
			//		Resolve the _storeReady deferred. (the store is ready for operation).
			// tag:
			//		private
			return this._storeReady.resolve(result);
		},

		//=========================================================================
		// Public cbtree/store/api/store API methods

		add: function (/*Object*/ object,/*PutDirectives?*/ options) {
			// summary:
			//		Creates an object, throws an error if the object already exists
			// object:
			//		The object to store.
			// options:
			//		Additional metadata for storing the data.	Includes an "id"
			//		property if a specific id is to be used.
			// returns:
			//		String or Number
			// tag:
			//		Public

			this._assertStore( this, "add", true );
			if (object) {
				var options = lang.mixin( options, {overwrite: false} );
				return this._storeRecord( object, options );
			}
			throw new StoreError("DataError", "add");
		},

		clear: function () {
			// summary:
			//		Clear all records from the the store and associated indexes.
			// tag:
			//		Public
			
			this._assertStore( this, "clear", true );
			this._clearRecords();
			this.dispatchEvent( new Event( "clear" ) );
		},
		
		close: function (/*Boolean?*/ clear) {
			// summary:
			//		Closes the store and optionally clear it. Note: this method has no
			//		effect if the store isn't cleared.
			// clear:
			//		If true, the store is reset. If not specified the store property
			//		'clearOnClose' is used instead.
			// tag:
			//		Public

			this._assertStore( this, "close", true );
			if (this._storeReady.isFulfilled()) {
				this._storeReady = new Deferred();
			}
			var clearStore = !!(clear || this.clearOnClose);
			if (!!clearStore) {
				this._clearRecords();
				this.total = 0;
			}
			this.dispatchEvent( new Event( "close" ) );
		},

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

			AbstractOnly("count");
		},
		
		createIndex: function (/*String*/ name,/*KeyPath*/ keyPath, /*Object?*/ options ) {
			// summary:
			//		Create and returns a new index with the given name and parameters.
			//		If an index with the same name already exists, a exception of type
			//		ItemExist is thrown.
			// name:
			//		The name of a new index.
			// keyPath:
			//		The key path used by the new index.
			// options:
			//		The options object whose attributes are optional parameters to this
			//		function. 'unique' specifies whether the index's unique flag is set.
			//		'multiEntry' specifies whether the index's multiEntry flag is set.
			// returns:
			//		An store Index object.
			// tag:
			//		Public
			this._assertStore( this, "createIndex", true );
			if (name && keyPath) {
				if (!this.indexNames.contains(name)) {
					var index = new Index(this, name, keyPath, options);
					if (index) {
						var indexNames = this.indexNames.toArray();
						indexNames.push(name);
						this.indexNames = new DOMStringList(indexNames);
						this._indexes[name] = index;
						return index;
					}
				}
				throw new StoreError("ConstraintError", "createIndex", "index with name %{0} already exist", name);
			} 
			throw new StoreError("DataError", "createIndex");
		},

		deleteIndex: function (/*DOMString*/ name) {
			// summary:
			//		Destroys the index with the given name.
			// name:
			//		The name of an existing index.
			// tag:
			//		Public
			var index = this._indexes[name];
			var names;
			
			this._assertStore( this, "deleteIndex", true );
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
			//		Release all memory and mark store as destroyed.
			// tag:
			//		Public
			this._assertStore( this, "destroy", true );
			this._destroyed = true;
			this._clearRecords();
		},

		get: function (/*Key*/ key) {
			// summary:
			//		Retrieves an object by its key
			// key:
			//		The key or key range used to lookup the object. If key is a key
			//		range the first object in range is returned.
			// returns:
			//		The object in the store that matches the given key.
			// tag:
			//		Public
			this._assertStore( this, "get", false );
			this._assertKey( key, "get", true );
			var record = this._retrieveRecord(key).record;
			if (record) {
				return (this._clone ? clone(record.value) : record.value);
			}
		},

		getIdentity: function (/*Object*/ object) {
			// summary:
			//		Returns an object's identity (key).  Note that the key returned
			//		may not be a valid key!
			// object:
			//		The object to get the identity from
			// returns:
			//		Key value.
			// tag:
			//		Public
			if (this.keyPath) {
				var key = Keys.keyValue(this.keyPath, object);
				return this.uppercase ? Keys.toUpperCase(key) : key;
			}
		},

		getRange: function (/*Key|KeyRange*/ keyRange, /*QueryOptions?*/ options) {
			// summary:
			//		Retrieve a range of store records.
			// keyRange:
			//		A KeyRange object or a valid key.
			// options:
			//		The optional arguments to apply to the resultset.
			// returns: dojo/store/api/Store.QueryResults
			//		The results of the query, extended with iterative methods.
			// tag:
			//		Public

			AbstractOnly("getRange");
		},

		index: function (name){
			// summary:
			//		Returns an Index object representing an index that is part of the
			//		store.
			// name:
			//		The name of an existing index.
			// returns:
			//		An Index object || undefined
			// tag:
			//		Public
			var index = this._indexes[name];
			if (index) {
				return index;
			}
			throw new StoreError( "NotFound", "index", "index with name [%{0}] does not exist", name);
		},

		isItem: function (/*Object*/ object) {
			// summary:
			//		Test if object is a member of this store.
			// object:
			//		Object to test.
			// returns:
			//		Boolean true of false
			// tag:
			//		Public
			if (isObject(object)) {
				return !!this.get( this.getIdentity(object) );
			}
			return false;
		},

		put: function (/*Object*/ object,/*PutDirectives?*/ options) {
			// summary:
			//		Stores an object
			// object:
			//		The value to be stored in the record.
			// options:
			//		Additional metadata for storing the data.
			// returns:
			//		String or Number
			// tag:
			//		Public
			this._assertStore( this, "put", true );
			if (object) {
				return this._storeRecord( object, options );
			}
			throw new StoreError("DataError", "put");
		},

		query: function (/*Object*/ query,/*QueryOptions?*/ options) {
			// summary:
			//		Queries the store for objects.
			// query: Object
			//		The query to use for retrieving objects from the store.
			// options:
			//		The optional arguments to apply to the resultset.
			// returns: dojo/store/api/Store.QueryResults
			//		The results of the query, extended with iterative methods.
			// tag:
			//		Public
			return QueryResults( this.queryEngine(query, options)(this._records));
		},

		ready: function (/*Function?*/ callback,/*Function?*/ errback, /*Function*/ progress, /*thisArg*/ scope) {
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
			// progress:
			// scope:
			//		The scope/closure in which callback and errback are executed. If
			//		not specified the store is used.
			// returns:
			//		dojo/promise/Promise
			// tag:
			//		Public
			if (callback || errback || progress) {
				this._storeReady.then(
					callback ? lang.hitch( (scope || this), callback) : null, 
					errback  ? lang.hitch( (scope || this), errback)  : null,
					progress ? lang.hitch( (scope || this), progress) : null
				);
			}
			return this._storeReady.promise;
		},

		remove: function (/*Key|KeyRange*/ key) {
			// summary:
			//		Deletes an object by its key
			// key:
			//		The key or key range identifying the record to be deleted.
			// returns:
			//		Returns true if an object was removed otherwise false.
			// tag:
			//		Public
			this._assertStore( this, "remove", true );
			this._assertKey( key, "remove", true );
			return this._deleteKeyRange(key);
		}

	};	/* end _Store */

	return declare([Stateful, EventTarget], _Store);

});	/* end define() */
