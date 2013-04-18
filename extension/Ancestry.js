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
				"../error/createError!../error/StoreErrors.json",
				"./_Path",
        "./_PathList"
        ], function (declare, Keys, Lib, createError, Path, PathList) {
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
	var isObject   = Lib.isObject;
	var undef;
	
	var Ancestry = {
		// summary:
		//		The Ancestry object is a collection of functions adding additional
		//		capabilities to the Hierarchy extension.

		constructor: function () {
			if (this.features.has("hierarchy")) {
				this.features.add("ancestry");
			} else {
				throw new StoreError( "MethodMissing", "constructor", "hierarchy extension required");
			}
		},
		
		//=========================================================================
		// Private methods

		_anyToObject: function (/*Object|Key*/ any) {
			// summary:
			// any:
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

		analyze: function (/*Number*/ maxCount ) {
			// summary:
			//		Analyze the store hierarchy and report any broken links.
			// maxCount:
			//		The maximum number of missing object deteced before the store
			//		analysis is aborted.
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
			
			data.some( function (record) {
				var parentIds = this._getParentArray(record.value);		
				var oops = parentIds.filter( function(parentId) {
					var locator = this._retrieveRecord(parentId);
					return !(locator && locator.record);
				}, this);
				
				oops.forEach( function (parentId) {
					var ref, itemId = this.getIdentity(record.value);
					if (ref = miss[parentId]) {
						ref.push(itemId);
					} else {
						ref = [itemId];
						count++;
					}
					miss[parentId] = ref;
				}, this);
				return (maxms && maxms <= count);
			}, this);
			return !Lib.isEmpty(miss) ? miss : null;
		},

		getAncestors: function (/*Object|Id*/ item, /*Boolean?*/ idOnly) {
			// summary:
			//		Get all ancestors of a given item.
			// item:
			//		A valid store object or object id.
			// idOnly:
			//		If set to true only the ancestor ids are returned.
			// returns:
			//		If the item exists, an array of store object or ids otherwise
			//		undefined. If an empty array is returned (length=0) it indicates
			//		that item has no parents and therefore is considered a top-level
			//		item.
			// tag:
			//		Public

			function _getAncestors (store, item) {
				store.getParents(item).forEach( function (parent) {
					var key = store.getIdentity(parent);
					// Skip duplicates....
					if (Keys.indexOf(keyList, key) == -1) {
						ancestors.push(parent);
						keyList.push(key);
						_getAncestors(store, parent);
					}
				});
			}

			var item = this._anyToObject(item);
			var ancestors = [], keyList = [];

			if (item) {
				_getAncestors (this, item);
				return (idOnly ? keyList : ancestors);
			}
		},

		getDescendants: function (/*Object|Id*/ item, /*Boolean?*/ idOnly) {
			// summary:
			//		Get all descendants of a given item.
			// item:
			//		A valid store object or object id.
			// idOnly:
			//		If set to true only the descendant ids are returned.
			// returns:
			//		If the item exists, an array of store object or ids otherwise
			//		undefined. If an empty array is returned (length=0) it indicates
			//		that item has no parents and therefore is considered a top-level
			//		item.
			// tag:
			//		Public

			function _getDescendants (store, item) {
				store.getChildren(item).forEach( function (child) {
					var key = store.getIdentity(child);
					if (Keys.indexOf(keyList, key) == -1) {
						descendants.push(child);
						keyList.push(key);
						_getDescendants(store, child);
					}
				});
			}

			var item = this._anyToObject(item);
			var descendants = [], keyList = [];

			if (item) {
				_getDescendants(this, item);
				return (idOnly ? keyList : descendants);
			}
		},

		getPaths: function (/*Object|Id*/ item, /*String?*/ separator) {
			// summary:
			//		Returns the virtual path(s) of an item. Each path segment represents
			//		the identifier of an ancestor with the exception of the last segment
			//		which is the item identifier.
			// item:
			//		The item whose path(s) are to be returned. Item is either an object
			//		or an identifier.
			// separator:
			//		Specifies the character to use for separating the path segments.
			//		Default is the forward slash (/).
			// returns:
			//		A PathList. If the item does not exist undefined is returned.
			// tag:
			//		Public
			var item = this._anyToObject(item);
			var sepr = separator || "/";
			var self = this;
			
			function _addPath (item, path, list) {
				var parents = self.getParents(item);
				if (parents.length) {
					parents.forEach( function (parent) {
						var currPath = self.getIdentity(parent) + sepr + path;
						list = _addPath(parent, currPath, list);
					});
				} else {
					// If no more parents, add current path.
					list = list || new PathList();
					list.push( new Path(path, sepr) );
				}
				return list;
			}
			
			if (item) {
				var pathList = _addPath(item, this.getIdentity(item), null );
				return pathList;
			}
		},

		getSiblings: function (/*Object|Id*/ item, /*Boolean?*/ idOnly) {
			// summary:
			//		Get the siblings of an item.
			// item:
			//		A valid store object or object id.
			// idOnly:
			//		If set to true only the sibling ids are returned.
			// returns:
			//		If the item exists, an array of store object or ids otherwise
			//		undefined. If an empty array is returned (length=0) it indicates
			//		that item has no siblings.
			// tag:
			//		Public
			var item = this._anyToObject(item);
			var sibl = [], keyList = [];
			
			if (item) {
				var id = this.getIdentity(item);
				this.getParents(item).forEach( function (parent) {
					this.getChildren(parent).forEach( function (child) {
						var key = this.getIdentity(child);
						if (Keys.cmp(id,key) && Keys.indexOf(keyList,key) == -1) {
							keyList.push(key);
							sibl.push(child);
						}
					},this);
				}, this);
				return (idOnly ? keyList : sibl);
			}
		},

		isAncestorOf: function (/*Object|Id*/ ancestor, /*Object|Id*/ item) {
			// summary:
			//		Returns true if the object identified by argument 'ancestor' is an
			//		ancestor of the object identified by argument 'item'.
			// ancestor:
			//		A valid store object or object id.
			// item:
			//		A valid store object or object id.
			// returns:
			//		Boolean true or false.
			// tag:
			//		Public
			
			ancestor = this._anyToObject(ancestor);
			item     = this._anyToObject(item);
			if (ancestor && item) {
				var anc  = this.getAncestors( item, true );
				return (Keys.indexOf(anc, this.getIdentity(ancestor)) != -1);
			}
			return false;
			
		},
		
		isChildOf: function (/*Object|Id*/ item, /*Object|Id*/ parent) {
			// summary:
			//		Validate if an item is a child of a given parent.
			// item:
			//		A valid store object or object id.
			// parent:
			//		A valid store object or object id.
			// returns:
			//		Boolean true or false.
			// tag:
			//		Public
			var parent = this._anyToObject(parent);
			var item   = this._anyToObject(item);

			if (this.parentProperty && (parent && item) ) {
				var parentIds = this._getParentArray(item);
				return (parentIds.indexOf( this.getIdentity(parent) ) != -1);
			}
			return false;
		},

		isDescendantOf: function (/*Object|Id*/ item, /*Object|Id*/ ancestor) {
			// summary:
			//		Validate if an item is a descendant of a given ancestor. 
			//		The following assumption must be true:
			//		- If A is a descendant of B than B must be an ancestor of A.
			// item:
			//		A valid store object or object id.
			// ancestor:
			//		A valid store object or object id.
			// returns:
			//		Boolean true or false.
			// tag:
			//		Public
			return this.isAncestorOf(ancestor,item);
		},
		
		isSiblingOf: function (/*Object|Id*/ item,/*Object|Id*/ sibling) {
			// summary:
			//		Returns true if the object identified by argument 'item' is the
			//		sibling of the object identified by argument 'sibling'.
			// item:
			//		A valid store object or object id.
			// returns:
			//		Boolean true or false.
			// tag:
			//		Public
			var sibling = this._anyToObject(sibling);
			var item    = this._anyToObject(item);

			var siblings = this.getSiblings(sibling, true);
			return (Keys.indexOf( siblings, this.getIdentity(item)) != -1);
		}
		
	};	/* end declare(1) */

	return declare( null, Ancestry );

});
