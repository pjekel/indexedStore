//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/declare",
		"dojo/when",
		"../_base/_assert",
		"../_base/Keys",
		"../_base/library",
		"../_base/range",
		"../error/createError!../error/StoreErrors.json",
		"../util/QueryResults"
	], function (declare, when, assert, Keys, lib, range, createError, QueryResults) {

	var StoreError = createError("Hierarchy");		// Create the StoreError type.
	var isObject   = lib.isObject;
	var clone      = lib.clone;

	var C_INDEXNAME  = "parents";
	// module:
	//		store/extension/Hierarchy
	// summary:

	var HierarchyDirectives = {
		// multiParented: Boolean|String
		//		Indicates if the store is to support multi-parented objects. If true
		//		the parent property	of store objects is stored as an array allowing
		//		for any object to have multiple parents.	If "auto", multi-parenting
		//		will be determined by the data loaded into the store.
		multiParented: "auto",

		// parentProperty: String
		//		 The property name of an object whose value represents the object's
		//		parent id(s).
		parentProperty: "parent"
	};

	var Hierarchy = declare(null, {

		//=========================================================================
		// constructor

		constructor: function (kwArgs) {
			if (this.features.has("indexed") || this.features.has("natural")) {
				if (this.features.has("observable")) {
					throw new StoreError("Dependency", "constructor", "Observable must be loaded after the Hierarchy module");
				}
				// Mix in the appropriate directives...
				lib.defProp(this, "hierarchical", {value: true, writable: false, enumerable: true});
				this._directives.declare(HierarchyDirectives, kwArgs);

				if (this.parentProperty instanceof Array || !Keys.validPath(this.parentProperty)) {
					throw new StoreError("TypeError", "constructor", "invalid keypath: '%{0}'", this.parentProperty);
				}
				this.createIndex(C_INDEXNAME, this.parentProperty, { unique: false, multiEntry: true});
				this._register("preload", this._preload, this);
				this.features.add("hierarchy");
			} else {
				throw new StoreError("Dependency", "constructor", "base class '_Natural' or '_Indexed' must be loaded first");
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
			//		Protected
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
			//		Protected
			var parentIds = [];

			if (parents != null) {
				parents = (parents instanceof Array ? parents : [parents]);
				parents.forEach(function (parent) {
					if (isObject(parent)) {
						parent = this.getIdentity(parent);
					}
					if (Keys.validKey(parent)) {
						// Make sure we don't parent ourself or return duplicates.
						if (Keys.cmp(parent, key) && Keys.indexOf(parentIds, parent) == -1) {
							parentIds.push(parent);
						}
					} else {
						throw new StoreError("DataError", "_getParentKeys", "parent id is an invalid key");
					}
				}, this);
			}
			return parentIds;
		},

		_preload: function (action, data) {
			// summary:
			//		Auto detect multi-parenting. If the store property 'multiParented'
			//		is set to "auto" test if any object has a parent property whose
			//		value is an array. If so, switch to the multi parented mode.
			//		This method is called as the result of a 'load' trigger by any of
			//		the loaders.
			// data: Object[]
			//		An array of objects.
			// tag:
			//		Protected, callback
			if (data instanceof Array && this.multiParented == "auto") {
				if (data.length > 0) {
					// Detect the multi parent mode.
					this.multiParented = data.some(function (object) {
						return (object[this.parentProperty] instanceof Array);
					}, this);
				}
			}
		},

		_setParentType: function (value, parents) {
			// summary:
			//		Convert the parent(s) from a single value to an array or vice versa
			//		depending on the value of the store multiParented property.
			// value: Object
			// parents: Key|Key[]
			// tag:
			//		Protected
			var isArray = parents instanceof Array;
			if (this.multiParented === false) {
				if (isArray) {
					parents = (parents.length ? parents[0] : undefined);
				}
			} else if (this.multiParented === true) {
				if (!isArray) {
					parents = (parents ? [parents] : []);
				}
			} else if (this.multiParented === "auto") {
				this.multiParented = (parents instanceof Array && parents.length > 1);
				return this._setParentType(value, parents);
			}
			value[this.parentProperty] = parents;
		},

		_storeOrder: function (keys) {
			// summary:
			//		Retrieve the objects associated with the keys in store (natural)
			//		order.
			// keys: Key[]
			// returns: Object[]
			//		An array of objects in store order.
			// tag:
			//		Protected
			var loc, temp = [];

			keys.forEach(function (key) {
				loc = this._retrieveRecord(key);
				temp[loc.eq] = loc.value;
			}, this);
			return temp.filter(function () { return true; });
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
			//		Protected
			var key, optKey, parents;

			if (options && options.parent != null) {
				optKey  = options.key != null ? options.key : (options.id != null ? options.id : null);
				key     = Keys.keyValue(this.keyPath, value, this.uppercase) || optKey;
				parents = this._getParentKeys(key, options.parent);
			} else {
				parents = value[this.parentProperty];
			}
			// Convert the 'parent' property to the required format.
			this._setParentType(value, parents);
			return this.inherited(arguments);
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
				var newKeys = this._getParentKeys(this.getIdentity(child), parents);
				if (newKeys.length) {
					var oldKeys  = this._getParentArray(child);
					var oldChild = clone(child);
					var options  = {};
					newKeys = oldKeys.slice();
					newKeys.forEach(function (key) {
						// key can be an array therefore use Keys.indexOf().
						if (Keys.indexOf(newKeys, key) == -1) {
							newKeys.unshift(key);
						}
					});
					// If the parents changed go update the store.
					if (Keys.cmp(oldKeys, newKeys)) {
						options[this.parentProperty] = newKeys;
						this.put(oldChild, options);
						return true;
					}
				}
				return false;
			}
			throw new StoreError("DataError", "addParent");
		},

		getChildren: function (parent, options) {
			// summary:
			//		Retrieves the children of an object.
			// parent: Object|Key
			//		The object or key to find the children of.
			// options: Store.QueryOptions
			//		Additional options to apply to the retrieval of the children.
			// returns: QueryResults
			//		dojo/store/api/Store.QueryResults: A result set of the children of
			//		the parent object.
			// tag:
			//		Public
			var key   = isObject(parent) ? this.getIdentity(parent) : parent;
			var index = this.index(C_INDEXNAME);
			var values, refKeys, results, query = {};

			assert.index(index, "getChildren");

			if (Keys.validKey(key)) {
				if (key != null) {
					// Depending on if this is an indexed or natural store we either
					// fetch the records directly using the 'parents' index, or get
					// the primary keys and fetch the records locally preserving the
					// store order.
					if (this.natural) {
						refKeys = range.keys(index, key, "next");
						values = this._storeOrder(refKeys);
					} else {
						values = range.values(index, key);
					}
					query[this.parentProperty] = key;
					// Call the query() method so the result can be made observable.
					results = this.query(query, options, values);
				} else {
					results = QueryResults([]);
				}
				return results;
			}
			throw new StoreError("DataError", "getChildren");
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

				parentKeys.forEach(function (key) {
					var parent = this.get(key);
					if (parent) {
						parents.push(parent);
					}
				}, this);
				return parents;
			}
			throw new StoreError("DataError", "getParents");
		},

		getParentsIndex: function () {
			return this.index(C_INDEXNAME);
		},

		hasChildren: function (parent) {
			// summary:
			//		Test if a parent object has known children.
			// parent: Object
			// returns: Boolean
			//		 true if the parent object has known children otherwise false.

			if (isObject(parent)) {
				var index = this.index(C_INDEXNAME);
				return Boolean(index.get(this.getIdentity(parent)));
			}
			throw new StoreError("DataError", "hasChildren");
		},

		removeChildren: function (parent, recursive) {
			// summary:
			//		Remove all children of a given parent
			// parent: Object|Key
			//		The parent whose descendants are to be removed.
			// recursive: Boolean?
			//		If true, all descendants of parent are removed.
			// tag:
			//		Public
			function deleteChildren(store, index, parentKey, recursive) {
				var childKeys = range.keys(index, parentKey);
				childKeys.forEach(function (key) {
					if (recursive) {
						deleteChildren(store, index, key);
					}
					store._deleteKeyRange(key);
				});
			}

			var pKey  = isObject(parent) ? this.getIdentity(parent) : parent;
			var index = this.index(C_INDEXNAME);
			var childKeys;

			assert.index(index, "removeChildren");

			if (Keys.validKey(pKey)) {
				deleteChildren(this, index, pKey, recursive);
				return;
			}
			throw new StoreError("DataError", "removeChildren");
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
			// tag:
			//		Public

			if (isObject(child)) {
				var remKeys = this._getParentKeys(this.getIdentity(child), parents);
				if (remKeys.length) {
					var oldKeys  = this._getParentArray(child);
					var newKeys  = oldKeys.slice();
					var oldChild = clone(child);
					var options = {};
					newKeys = newKeys.filter(function (key) {
						// key can be an array therefore use Keys.indexOf().
						return (Keys.indexOf(remKeys, key) == -1);
					});
					// If the parents changed go update the store.
					if (Keys.cmp(oldKeys, newKeys)) {
						options[this.parentProperty] = newKeys;
						this.put(oldChild, options);
						return true;
					}
				}
				return false;
			}
			throw new StoreError("DataError", "addParent");
		}
	});	/* end declare() */
	return Hierarchy;
});	/* end define() */
