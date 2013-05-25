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
				"../_base/Keys",
				"../_base/Library",
				"../_base/Range",
				"../error/createError!../error/StoreErrors.json",
				"../util/QueryResults"
			 ], function (declare, Keys, Lib, Range, createError, QueryResults) {

	var StoreError = createError( "Hierarchy" );		// Create the StoreError type.
	var isObject   = Lib.isObject;
	var clone      = Lib.clone;
	var undef;
	
	var C_INDEXNAME  = "parents";
	// module:
	//		store/extension/Hierarchy
	// summary:

	var Hierarchy = {

		// multiParented: Boolean|String
		//		Indicates if the store is to support multi-parented objects. If true
		//		the parent property	of store objects is stored as an array allowing
		//		for any object to have multiple parents.	If "auto", multi-parenting
		//		will be determined by the data loaded into the store.
		multiParented: "auto",

		// parentProperty: String
		//		 The property name of an object whose value represents the object's
		//		parent id(s).
		parentProperty: "parent",

		// End constructor keyword arguments
		//=========================================================================

		// hierarchical: Boolean [read-only]
		//		Indicates this store is capable of maintaining an object hierarchy.
		//		The cbtree Models tests for the presence of this property in order to
		//		determine if it has to set the parent property of an object or if the
		//		store will handle it.
		hierarchical: true,

		//=========================================================================
		// constructor
		
		constructor: function (kwArgs) {
			if (this.features.has("indexed") || this.features.has("natural")) {
				if (this.features.has("observable")) {
					throw new StoreError( "Dependency", "constructor", "Observable must be loaded after the Hierarchy module");
				}
				if (this.parentProperty instanceof Array || !Keys.validPath(this.parentProperty)) {
					throw new StoreError( "TypeError", "constructor", "invalid keypath: '%{0}'", this.parentProperty );
				}
				this.createIndex( C_INDEXNAME, this.parentProperty, { unique:false, multiEntry:true});

				this.features.add("hierarchy");
			} else {
				throw new StoreError( "Dependency", "constructor", "base class '_Natural' or '_Indexed' must be loaded first");
			}
		},
		
		//=========================================================================
		// Private methods

		_getParentArray: function (object) {
			// summary:
			//		Return the parent(s) of an object as an array of keys.
			// object: Object
			//		Store object
			// returns: Keys[]
			//		An array of parent Ids.
			// tag:
			//		Private
			var parentIds = object[this.parentProperty] || [];
			return (parentIds instanceof Array ? parentIds : [parentIds]);
		},

		_getParentKeys: function (key, parents) {
			// summary:
			//		Extract the parent ids from a list of parents.
			// key: Key
			//		The object key.
			// parents: Any
			//		The parent(s) of an object. The parents arguments can be a key,
			//		an object or an array of objects or keys.
			// returns: Keys[]
			//		An array of parent keys.
			// tag:
			//		Private
			var parentIds = [];

			if (parents) {
				parents = (parents instanceof Array ? parents : [parents]);
				parents.forEach( function (parent) {
					if (isObject(parent)) {
						parent = this.getIdentity(parent);
					}
					if (Keys.validKey(parent)) {
						// Make sure we don't parent ourself or return duplicates.
						if (Keys.cmp(parent,key) && Keys.indexOf(parentIds, parent) == -1) {
							parentIds.push(parent);
						}						
					} else {
						throw new StoreError("DataError", "_getParentKeys", "parent id is an invalid key");
					}
				}, this);
			}
			return parentIds;
		},

		_loadData: function (data) {
			// summary:
			//		Load an array of data objects into the store and indexes it. If the
			//		store property 'multiParented' is set to "auto" test if any object
			//		has a parent property whose value is an array. If so, switch to the
			//		multi parented mode.
			// data: Object[]
			//		An array of objects.
			// tag:
			//		Private

			if (data instanceof Array && this.multiParented == "auto") {
				if (data.length > 0) {
					// Detect the multi parent mode.
					this.multiParented = data.some( function (object) {
						return (object[this.parentProperty] instanceof Array);
					}, this);
				}
			}
			// Load the store
			this.inherited(arguments);
		},

		_storeRecord: function (value, options) {
			// summary:
			//		Add a record to the store. Throws a StoreError of type ConstraintError
			//		if the key already exists and overwrite flag is set to true.
			// value: Any
			//		Record value property
			// options: Store.Putdirectives
			//		Optional, PutDirectives
			// returns: Key
			//		Record key.
			// tag:
			//		Private
			var parents = value[this.parentProperty];
			
			if (options && options.parent) {
				var key = options.key != undef ? options.key : (options.id != undef ? options.id : null);
				key = Keys.keyValue(this.keyPath, value) || key;
				key = this.uppercase ? Keys.toUpperCase(key) : key;
				parents = this._getParentKeys(key, options.parent);
			}
			// Convert the 'parent' property to the correct format.
			this._setParentType(value, parents);
			return this.inherited(arguments);
		},

		_setParentType: function (value, parents) {
			// summary:
			//		Convert the parent(s) from a single value to an array or vice versa
			//		depending on the value of the store multiParented property.
			// value: Object
			// parents: Key|Key[]
			// tag:
			//		Private
			var isArray = parents instanceof Array;
			switch( this.multiParented ) {
				case false:
					if (isArray) { 
						parents = (parents.length ? parents[0] : undef);	
					}
					break;
				case true:
					if (!isArray) {
						parents = (parents ? [parents] : []);
					}
					break;
				case "auto":
					this.multiParented = (parents instanceof Array);
					break;
			}
			value[this.parentProperty] = parents;
		},

		_storeOrder: function (range) {
			// summary:
			//		Retrieve the objects associated with the range in store (natural)
			//		order.
			// range: Range
			// returns: Object[]
			//		An array of objects in store store order.
			// tag:
			//		Private
			var loc, temp = [];

			range.forEach( function (key) {
				loc = this._retrieveRecord( key );
				temp[loc.eq] = loc.value;
			}, this);
			return temp.filter( function() {return true;} );
		},

		//=========================================================================
		// Public IndexedStore/api/Hierarchy API methods

		addParent: function (child, parents) {
			// summary:
			//		Add parent(s) to the list of parents of child.
			// child: Object
			//		Store object to which the parent(s) are added
			// parents: Any
			//		Key or Object or an array of keys or objects to be added as the
			//		parent(s) of child.
			// returns:
			//		true if parent key(s) were successfully added otherwise false.

			if (isObject(child)) {
				var newKeys = this._getParentKeys( this.getIdentity(child), parents );
				if (newKeys.length) {
					var oldKeys = this._getParentArray(child);
					var newKeys = oldKeys.slice();
					var child   = clone(child);
					var options = {};
					newKeys.forEach( function (key) {
						// key can be an array therefore use Keys.indexOf().
						if (Keys.indexOf(newKeys,key) == -1) {
							newKeys.unshift(key);
						}
					});
					// If the parents changed go update the store.
					if (Keys.cmp(oldKeys, newKeys)) {
						options[this.parentProperty] = newKeys;
						this.put(child, options);
						return true;
					}
				}
				return false;
			}
			throw new StoreError( "DataError", "addParent");
		},

		getChildren: function (parent, options) {
			// summary:
			//		Retrieves the children of an object. If the store is a non-indexed
			//		store the children are returned in their natural order.
			// parent: Object
			//		The object to find the children of.
			// options: Store.QueryOptions
			//		Additional options to apply to the retrieval of the children.
			// returns: QueryResults
			//		dojo/store/api/Store.QueryResults: A result set of the children of
			//		the parent object.
			// tag:
			//		Public

			if (isObject(parent)) {
				var key = this.getIdentity(parent);
				if (key) {
					var index = this.index(C_INDEXNAME);
					var range, keys, query = {};
					
					// Depending on if this is an indexed or natural store we either fetch
					// the records directly using the 'parents' index, or simply get the
					// primary keys and fetch the records locally preserving the store
					// order.

					if (this.indexed) {
						range = Range( index, key, "next", true, false );
					} else {
						keys  = Range( index, key, "next", true, true );
						range = this._storeOrder( keys );
					}
					query[this.parentProperty] = key;
					// Call the query() method so the result can be made observable.
					return this.query( query, options, range );
				} else {
					return QueryResults([]);
				}
			}
			throw new StoreError( "DataError", "getChildren");
		},

		getParents: function (child) {
			// summary:
			//		Retrieve the parent(s) of an object
			// child: Object
			//		Child object to retrieve the parents for.
			// returns: Object[]
			//		An array of objects or void if the child is not a valid object.
			// tag:
			//		Public
			if (isObject(child)) {
				var parentKeys = this._getParentArray(child);
				var parents    = [];

				parentKeys.forEach( function (key) {
					var parent = this.get(key);
					if (parent) {
						parents.push(parent);
					}
				}, this);
				return parents;
			}
			throw new StoreError( "DataError", "getParents");
		},

		hasChildren: function (parent) {
			// summary:
			//		Test if a parent object has known children.	
			// parent: Object
			// returns: Boolean
			//		 true if the parent object has known children otherwise false.

			if (isObject(parent)) {
				var index = this.index(C_INDEXNAME);
				return Boolean( index.get(this.getIdentity(parent)) );
			}
			throw new StoreError( "DataError", "hasChildren");
		},

		query: function (query, options /*, data */) {
			// summary:
			//		Queries the store for objects. The query executes asynchronously if,
			//		and only if, the store is not ready or a load request is currently
			//		in progress.
			// query: Object?
			//		The query to use for retrieving objects from the store.
			// options: QueryOptions?
			//		The optional arguments to apply to the resultset.
			// returns: dojo/store/api/Store.QueryResults
			//		The results of the query, extended with iterative methods.
			// tag:
			//		Public

			// If the reserved argument data is specified the query is performed on
			// the data argument only. (INTERNAL USE ONLY)

			var data  = (arguments.length > 2 ?	arguments[2] : null);
			var defer = this.waiting || this.loader.loading;
			var store = this;

			// NOTE: defer is either boolean false or a dojo/promise/Promise.
			if (defer == false || data) {
				var objects = store.queryEngine(query, options)(data || store._records);
				return QueryResults( store._clone ? clone(objects) : objects );
			}
			// Store is not ready or a load request is in progress.
			var results = QueryResults( 
				when (defer, function () {
					var objects = store.queryEngine(query, options)(store._records);
					return store._clone ? clone(objects) : objects;
				})
			);
			return results;
		},

		removeParent: function (child, parents) {
			// summary:
			//		Remove a parent from the list of parents of child.
			// child: Object
			//		Store object from which the parent(s) are removed
			// parents: Any
			//		Key or Object or an array of keys or objects to be removed from the
			//		list of parent(s) of child.
			// returns: Boolean
			//		true if the parent key(s) were successfully removed otherwise false.

			if (isObject(child)) {
				var remKeys = this._getParentKeys( this.getIdentity(child), parents );
				if (remKeys.length) {
					var oldKeys = this._getParentArray(child);
					var newKeys = oldKeys.slice();
					var child   = clone(child);
					var options = {};
					newKeys = newKeys.filter( function (key) {
						// key can be an array therefore use Keys.indexOf().
						return (Keys.indexOf(remKeys, key) == -1);
					});
					// If the parents changed go update the store.
					if (Keys.cmp(oldKeys, newKeys)) {
						options[this.parentProperty] = newKeys;
						this.put(child, options);
						return true;
					}
				}
				return false;
			}
			throw new StoreError( "DataError", "addParent");
		}
	};	/* end Hierarch {} */
	
	return declare( null, Hierarchy );

});	/* end define() */
