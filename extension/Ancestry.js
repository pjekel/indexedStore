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
		"../_base/Keys",
		"../_base/library",
		"../error/createError!../error/StoreErrors.json",
		"./_Path",
		"./_PathList"
	], function (declare, Keys, lib, createError, Path, PathList) {
	"use strict";

	// module:
	//		store/extension/Ancestry
	// summary:
	//		This module extends the store/_base/_Store with the capabilities to
	//		explore and query the store hierarchy. Before the Ancestry extension
	//		can be loaded the store/extension/Hierarchy extension must have been
	//		loaded first otherwise an exception of type MethodMissingError is
	//		thrown. Ancestry includes, amongst others, functions like:
	//
	//			- getAncestors()
	//			- getDescendants()
	//			- getSiblings()
	//
	//		and many more....
	var StoreError = createError("Ancestry");		// Create the StoreError
	var isObject   = lib.isObject;

	var Ancestry = declare(null, {
		// summary:
		//		The Ancestry object is a collection of functions adding additional
		//		capabilities to the Hierarchy extension.
		constructor: function () {
			if (this.features.has("hierarchy")) {
				this.features.add("ancestry");
			} else {
				throw new StoreError("MethodMissing", "constructor", "hierarchy extension required");
			}
		},

		//=========================================================================
		// Private methods
		_anyToObject: function (any) {
			// summary:
			// any: Object|Key
			// returns:
			//		An Object | undefined
			// tag:
			//		Private
			if (isObject(any)) {
				return any;
			}
			if (Keys.validKey(any)) {
				var loc = this._retrieveRecord(any);
				var rec = loc.record || {};
				return rec.value;
			}
		},

		//=========================================================================
		// Public methods
		analyze: function (cleanup, maxCount) {
			// summary:
			//		Analyze the store hierarchy and report any broken links.
			// cleanup: Boolean?
			//		If true, references to missing parents will be removed from
			//		the child object.
			// maxCount: Number?
			//		The maximum number of missing objects detected before store
			//		analysis is aborted. maxCount is ignored if cleanup is true.
			// returns:
			//		A key:value pairs JavaScript object. Each key represents the
			//		identifier of a missing object.   The value is the array of
			//		identifiers referencing the missing object. If no object is
			//		missing null is returned.
			// tag:
			//		Public
			var maxms = maxCount > 0 ? maxCount : 0;
			var data  = this._records || [];
			var count = 0;
			var miss  = {};

			data.some(function (record) {
				var parentIds = this._getParentArray(record.value);
				var oops = parentIds.filter(function (parentId) {
					var locator = this._retrieveRecord(parentId);
					return !(locator && locator.record);
				}, this);

				oops.forEach(function (parentId) {
					var child = record.value;
					var key   = record.key;
					var ref   = miss[parentId] || [];
					if (ref.push(key) == 1) {
						miss[parentId] = ref;
						count++;
					}
					if (cleanup) {
						this.removeParent(child, parentId);
					}
				}, this);
				return (!cleanup && maxms && maxms <= count);
			}, this);
			return !lib.isEmpty(miss) ? miss : null;
		},

		getAncestors: function (item, idOnly) {
			// summary:
			//		Get all ancestors of a given item.
			// item: Object|Id
			//		A valid store object or object id.
			// idOnly: Boolean?
			//		If set to true only the ancestor ids are returned.
			// returns:
			//		If the item exists, an array of store object or ids otherwise
			//		undefined. If an empty array is returned (length=0) it indicates
			//		that item has no parents and therefore is considered a top-level
			//		item.
			// tag:
			//		Public
			function _getAncestors(store, item) {
				store.getParents(item).forEach(function (parent) {
					var key = store.getIdentity(parent);
					// Skip duplicates....
					if (Keys.indexOf(keyList, key) == -1) {
						ancestors.push(parent);
						keyList.push(key);
						_getAncestors(store, parent);
					}
				});
			}

			var ancestors = [], keyList = [];
			item = this._anyToObject(item);
			if (item) {
				_getAncestors(this, item);
				return (idOnly ? keyList : ancestors);
			}
		},

		getDescendants: function (item, idOnly) {
			// summary:
			//		Get all descendants of a given item.
			// item: Object|Id
			//		A valid store object or object id.
			// idOnly: Boolean?
			//		If set to true only the descendant ids are returned.
			// returns:
			//		If the item exists, an array of store object or ids otherwise
			//		undefined. If an empty array is returned (length=0) it indicates
			//		that item has no parents and therefore is considered a top-level
			//		item.
			// tag:
			//		Public
			function _getDescendants(store, item) {
				store.getChildren(item).forEach(function (child) {
					var key = store.getIdentity(child);
					if (Keys.indexOf(keyList, key) == -1) {
						descendants.push(child);
						keyList.push(key);
						_getDescendants(store, child);
					}
				});
			}

			var descendants = [], keyList = [];
			item = this._anyToObject(item);
			if (item) {
				_getDescendants(this, item);
				return (idOnly ? keyList : descendants);
			}
		},

		getPaths: function (item, separator) {
			// summary:
			//		Returns the virtual path(s) of an item. Each path segment represents
			//		the identifier of an ancestor with the exception of the last segment
			//		which is the item identifier.
			// item: Object|Id
			//		The item whose path(s) are to be returned. Item is either an object
			//		or an identifier.
			// separator: String?
			//		Specifies the character to use for separating the path segments.
			//		Default is the forward slash (/).
			// returns:
			//		A PathList. If the item does not exist undefined is returned.
			// tag:
			//		Public
			var sepr = separator || "/", self = this;
			item = this._anyToObject(item);

			function _addPath(item, path, list) {
				var parents = self.getParents(item);
				if (parents.length) {
					parents.forEach(function (parent) {
						var currPath = self.getIdentity(parent) + sepr + path;
						list = _addPath(parent, currPath, list);
					});
				} else {
					// If no more parents, add current path.
					list = list || new PathList();
					list.push(new Path(path, sepr));
				}
				return list;
			}

			if (item) {
				var pathList = _addPath(item, this.getIdentity(item), null);
				return pathList;
			}
		},

		getSiblings: function (item, idOnly) {
			// summary:
			//		Get the siblings of an item.
			// item: Object|Id
			//		A valid store object or object id.
			// idOnly: Boolean?
			//		If set to true only the sibling ids are returned.
			// returns:
			//		If the item exists, an array of store object or ids otherwise
			//		undefined. If an empty array is returned (length=0) it indicates
			//		that item has no siblings.
			// tag:
			//		Public
			var sibl = [], keyList = [];
			item = this._anyToObject(item);

			if (item) {
				var id = this.getIdentity(item);
				this.getParents(item).forEach(function (parent) {
					this.getChildren(parent).forEach(function (child) {
						var key = this.getIdentity(child);
						if (Keys.cmp(id, key) && Keys.indexOf(keyList, key) == -1) {
							keyList.push(key);
							sibl.push(child);
						}
					}, this);
				}, this);
				return (idOnly ? keyList : sibl);
			}
		},

		isAncestorOf: function (ancestor, item) {
			// summary:
			//		Returns true if the object identified by argument 'ancestor' is an
			//		ancestor of the object identified by argument 'item'.
			// ancestor: Object|Id
			//		A valid store object or object id.
			// item: Object|Id
			//		A valid store object or object id.
			// returns:
			//		Boolean true or false.
			// tag:
			//		Public
			ancestor = this._anyToObject(ancestor);
			item     = this._anyToObject(item);
			if (ancestor && item) {
				var anc  = this.getAncestors(item, true);
				return (Keys.indexOf(anc, this.getIdentity(ancestor)) != -1);
			}
			return false;
		},

		isChildOf: function (item, parent) {
			// summary:
			//		Validate if an item is a child of a given parent.
			// item: Object|Id
			//		A valid store object or object id.
			// parent: Object|Id
			//		A valid store object or object id.
			// returns:
			//		Boolean true or false.
			// tag:
			//		Public
			parent = this._anyToObject(parent);
			item   = this._anyToObject(item);

			if (this.parentProperty && (parent && item)) {
				var parentIds = this._getParentArray(item);
				return (parentIds.indexOf(this.getIdentity(parent)) != -1);
			}
			return false;
		},

		isDescendantOf: function (item, ancestor) {
			// summary:
			//		Validate if an item is a descendant of a given ancestor.
			//		The following assumption must be true:
			//		- If A is a descendant of B than B must be an ancestor of A.
			// item: Object|Id
			//		A valid store object or object id.
			// ancestor: Object|Id
			//		A valid store object or object id.
			// returns:
			//		Boolean true or false.
			// tag:
			//		Public
			return this.isAncestorOf(ancestor, item);
		},

		isSiblingOf: function (item, sibling) {
			// summary:
			//		Returns true if the object identified by argument 'item' is the
			//		sibling of the object identified by argument 'sibling'.
			// item: Object|Id
			//		A valid store object or object id.
			// sibling: Object|Id
			//		A valid store object or object id.
			// returns:
			//		Boolean true or false.
			// tag:
			//		Public
			sibling = this._anyToObject(sibling);
			item    = this._anyToObject(item);

			var siblings = this.getSiblings(sibling, true);
			return (Keys.indexOf(siblings, this.getIdentity(item)) != -1);
		}
	});	/* end Ancestry {} */
	return Ancestry;
});
