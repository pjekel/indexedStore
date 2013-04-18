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
				"dojo/aspect",
				"../_base/Keys",
				"../_base/Library",
				"../_base/Range",
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, lang, QueryResults, aspect, Keys, Lib, Range, createError) {

	var StoreError = createError( "Hierarchy" );		// Create the StoreError type.
	var isObject   = Lib.isObject;
	var undef;
	
	var C_INDEXNAME  = "parents";
	// module:
	//		store/extension/Hierarchy
	// summary:
	//		This store implements the cbtree/store/api/Store API which is an extension
	//		to the dojo/store/api/Store API.

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
				var store = this;
				this._addCallback( this._processParents );		// Add callback to the store.

				// Explicitly set the parentProperty before we create the index. We can't
				// post create the index as the optional Loader gets started first, that
				// is, before the parents index gets created.

				this.set("parentProperty", this.parentProperty );
				this.createIndex( C_INDEXNAME, this.parentProperty, { unique:false, multiEntry:true});

				this.features.add("hierarchy");
			} else {
				throw new StoreError( "MethodMissing", "constructor", "base class '_natural' or '_indexed' must be loaded first");
			}
		},
		
		//=========================================================================
		// Getters & Setters (see Stateful.js)

		_parentPropertySetter: function (keyPath) {
			// summary:
			//		Hook for set("parentProperty", ...). The parent property is a key
			//		path but NOT an array of key paths. The 'parentProperty' property
			//		is only updated if the 'parents' index hasn't been created yet.
			// keyPath:
			//		A valid key path.
			// tag:
			//		Private

			// Depnding on the strict mode the store function index() may throw an
			// exception of type 'NotFoundError' or return undefined. So, account
			// for both responses.
			try {
				if (this.index(C_INDEXNAME)) {
					return;
				}
			} catch(err) {
				if (err.name != "NotFoundError") {
					throw err;
				}
				// It's Ok, just continue. Anything else is an error.
			}
			if (keyPath instanceof Array || !Keys.validPath(keyPath)) {
				throw new StoreError( "TypeError", "_parentPropertySetter", "invalid keypath: '%{0}'", keyPath );
			}
			this.parentProperty = keyPath;
		},

		//=========================================================================
		// Private methods

		_getParentArray: function (/*Object*/ object) {
			// summary:
			//		Return the parent(s) of an object as an array of keys.
			// object:
			//		Store object
			// returns:
			//		An array of parent Ids.
			// tag:
			//		Private
			var parentIds = object[this.parentProperty] || [];
			return (parentIds instanceof Array ? parentIds : [parentIds]);
		},

		_getParentKeys: function (/*Key*/ key,/*any*/ parents) {
			// summary:
			//		Extract the parent ids from a list of parents.
			// key:
			//		The object key.
			// parents:
			//		The parent(s) of an object. The parents arguments can be a key,
			//		an object or an array of objects or keys.
			// returns:
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
			//		has a parent property whose value is an array. If so, make sure all
			//		store objects store their parents as an array.
			// data:
			//		An array of objects.
			// tag:
			//		Private

			if (data instanceof Array && this.multiParented == "auto") {
				if (data.length > 0) {
					// Detect the multi parent mode.
					this.multiParented = data.some( function (object) {
						return (object[this.parentProperty] instanceof Array);
					}, this);
					if (this.multiParented) {
						data.forEach( function (value) {
							this._setParentType(value, value[this.parentProperty]);
						}, this);
					}
				}
			}
			// Load the store
			this.inherited(arguments);
		},

		_processParents: function (key, at, newValue, oldValue, options) {
			// summary:
			//		Process any optional PutDirectives. This function is called as a 
			//		callback just before the record is stored, therefore do not alter
			//		any key path values.
			// key:
			//		key portion of a record.
			// value:
			//		Value portion of a record (JavaScript key:values pairs object)
			// options:
			// returns:
			//		new value.
			// tag:
			//		Private, callback
			var parents = newValue[this.parentProperty];
			if (options && options.parent) {
				parents = this._getParentKeys(key, options.parent);				
			}
			// Convert the 'parent' property to the correct format.
			this._setParentType(newValue, parents);
		},

		_setParentType: function (/*Object*/ value,/*Key|Key[]*/ parents) {
			// summary:
			//		Convert the parent(s) from a single value to an array or vice versa
			//		depending on the value of the store multiParented property.
			// value:
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

		_storeOrder: function (/*Range*/ range) {
			// summary:
			//		Retrieve the records associated with the cursor in store (natural)
			//		order.
			// cursor:
			//		Instance of Cursor
			// returns:
			//		An array of objects in store store order.
			// tag:
			//		Private
			var loc, temp = [];

			range.forEach( function (key) {
				loc = this._retrieveRecord( key );
				temp[loc.eq] = loc.record;
			}, this);
			return temp.filter( function() {return true;} );
		},

		//=========================================================================
		// Public cbtree/store/api/store API methods

		addParent: function(/*Object*/ child,/*any*/ parents) {
			// summary:
			//		Add parent(s) to the list of parents of child.
			// parents:
			//		Key or Object or an array of keys or objects to be added as the
			//		parent(s) of child.
			// child:
			//		Store object to which the parent(s) are added
			// returns:
			//		true if parent key(s) were successfully added otherwise false.

			if (isObject(child)) {
				var newKeys = this._getParentKeys( this.getIdentity(child), parents );
				if (newKeys.length) {
					var oldKeys = this._getParentArray(child);
					var newKeys = oldKeys.slice();
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

		getChildren: function (/*Object*/ parent, /*Store.QueryOptions?*/ options) {
			// summary:
			//		Retrieves the children of an object. If the store is a non-indexed
			//		store the children are returned in their natural order.
			// parent:
			//		The object to find the children of.
			// options:
			//		Additional options to apply to the retrieval of the children.
			// returns:
			//		dojo/store/api/Store.QueryResults: A result set of the children of
			//		the parent object.
			// tag:
			//		Public

			if (isObject(parent)) {
				var identity = this.getIdentity(parent);
				if (identity) {
					var index  = this.index(C_INDEXNAME);
					var range, keys, query = {};
					
					// Depending on if this is an indexed or natural store we either fetch
					// the records directly using the 'parents' index, or simply get the
					// primary keys and fetch the records locally preserving the store
					// order. (NOTE: indexes are ALWAYS in ascending order).

					if (this.indexed) {
						range = Range( index, identity, "next", true, false );
					} else {
						keys  = Range( index, identity, "next", true, true );
						range = this._storeOrder( keys );
					}
					query[this.parentProperty] = identity;
					// Call the query() method so the result can be made observable.
					return this.query( query, options, range );
				} else {
					return QueryResults([]);
				}
			}
			throw new StoreError( "DataError", "getChildren");
		},

		getParents: function (/*Object*/ child) {
			// summary:
			//		Retrieve the parent(s) of an object
			// child:
			//		Child object to retrieve the parents for.
			// returns:
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

		hasChildren: function(/*Object*/ parent) {
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

		query: function (/*Object*/ query,/*QueryOptions?*/ options /*((Object|Rceord)[])? _dataSet */) {
			// summary:
			//		Queries the store for objects.
			// query: Object
			//		The query to use for retrieving objects from the store.
			// options:
			//		The optional arguments to apply to the resultset.
			// _dataSet: (INTERNAL USE ONLY)
			//		If specified this array of objects is used instead of the full store
			//		data object array.
			// returns: dojo/store/api/Store.QueryResults
			//		The results of the query, extended with iterative methods.

			var _dataSet = (arguments.length == 3 ?	arguments[2] : null);
			var data     = _dataSet || this._records;
			var store    = this;
			
			return QueryResults( this.queryEngine(query, options)(data) );
		},

		removeParent: function(/*Object*/ child,/*any*/ parents) {
			// summary:
			//		Remove a parent from the list of parents of child.
			// parents:
			//		Key or Object or an array of keys or objects to be removed from the
			//		list of parent(s) of child.
			// child:
			//		Store object from which the parent(s) are removed
			// returns:
			//		true if the parent key(s) were successfully removed otherwise false.

			if (isObject(child)) {
				var remKeys = this._getParentKeys( this.getIdentity(child), parents );
				if (remKeys.length) {
					var oldKeys = this._getParentArray(child);
					var newKeys = oldKeys.slice();
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
