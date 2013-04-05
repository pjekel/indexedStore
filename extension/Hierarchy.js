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
				"dojo/_base/lang",
				"dojo/store/util/QueryResults",
				"../_base/Keys",
				"../_base/Library",
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, lang, QueryResults, Keys, Lib, createError) {

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
				// create the parents index
				this.createIndex( 
					C_INDEXNAME, 
					this.parentProperty, 
					{ unique:false, multiEntry:true}
				);
				this.features.add("hierarchy");
			} else {
				throw new StoreError( "MethodMissing", "constructor", "base class '_natural' or '_indexed' must be loaded first");
			}
		},
		
		//=========================================================================
		// Getters & Setters (see Stateful.js)

		_parentPropertySetter: function (keyPath) {
			// summary:
			//		Hook for set("parentProperty", ...). The parent property is a key path
			//		but NOT an array of key paths.
			// keyPath:
			//		A valid key path.
			// tag:
			//		Private
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
						if (Keys.cmp(parent,key) && parentIds.indexOf(parent) == -1) {
							parentIds.push(parent);
						}						
					} else {
						throw StoreError("DataError", "_getParentKeys", "parent id is an invalid key");
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
			// Load the store
			this.inherited(arguments);
		},

		_processOptions: function (key, value, options) {
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
			var parents = value[this.parentProperty];
			if (options) {
				if (options.parent) {
					parents = this._getParentKeys(key, options.parent);				
				}
			}
			// Convert the 'parent' property to the correct format.
			this._setParentType(value, parents);
			return value;
		},

		_setParentType: function (value, parents) {
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

		_storeOrder: function (/*Cursor*/ cursor) {
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
			while (cursor.primaryKey) {
				loc = this._retrieveRecord(cursor.primaryKey);
				temp[loc.eq] = cursor.value;
				cursor.continue();
			}
			return temp.filter( function() {return true;} );
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
			//		Object key
			// tag:
			//		Public
			this._assertStore( this, "add", true );
			if (object) {
				var options = lang.mixin( options, {overwrite: false} );
				return this._storeRecord( object, options, this._processOptions );
			}
			throw new StoreError("DataError", "add");
		},

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

			var childId = this.getIdentity(child);
			var newKeys = this._getParentKeys(childId, parents);
			if (newKeys.length) {
				var oldKeys = this._getParentArray(child);
				var curKeys = oldKeys.slice();
				newKeys.forEach( function (key) {
					// key can be an array therefore use Keys.indexOf().
					if (Keys.indexOf(curKeys,key) == -1) {
						curKeys.unshift(key);
					}
				});
				// If the parents changed go update the store.
				if (Keys.cmp(oldKeys, curKeys)) {
					this._setParentType(child, curKeys);
					this.put(child);
					return true;
				}
			}
			return false;
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
					var cursor = index.openCursor( identity );
					var query  = {};
					var dataSet;

					query[this.parentProperty] = identity;
					dataSet = !this.features.indexed ? this._storeOrder(cursor) : cursor;
					// Call the query() method so the result can be made observable.
					return this.query( query, options, dataSet );
				} else {
					return QueryResults([]);
				}
			}
			throw StoreError( "DataError", "getChildren");
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
			throw StoreError( "DataError", "getParents");
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
			throw StoreError( "DataError", "hasChildren");
		},

		put: function (/*Object*/ object,/*PutDirectives?*/ options) {
			// summary:
			//		Stores an object
			// object:
			//		The object to store.
			// options:
			//		Additional metadata for storing the data.
			// returns:
			//		String or Number
			// tag:
			//		Public

			this._assertStore( this, "put", true );
			if (object) {
				var options = lang.mixin( {overwrite: true}, options );
				return this._storeRecord( object, options, this._processOptions );
			}
			throw new StoreError("DataError", "put");
		},

		query: function (/*Object*/ query,/*QueryOptions?*/ options /*((Object|Rceord)[] | Cursor)? _dataSet */) {
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

			var childId = this.getIdentity(child);
			var remKeys = this._getParentKeys(childId, parents);
			if (remKeys.length) {
				var oldKeys = this._getParentArray(child);
				var curKeys = oldKeys.slice();
				curKeys = curKeys.filter( function (key) {
					return (Keys.indexOf(remKeys, key) == -1);
				});
				// If the parents changed go update the store.
				if (Keys.cmp(oldKeys, curKeys)) {
					this._setParentType(child, curKeys);
					this.put(child);
					return true;
				}
			}
			return false;
		}

	};	/* end Hierarch {} */
	
	return declare( null, Hierarchy );

});	/* end define() */
