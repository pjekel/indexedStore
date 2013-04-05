//
// Copyright (c) 2010-2013, Peter Jekel
// All rights reserved.
//
//	The Checkbox Tree (cbtree) is released under to following three licenses:
//
//	1 - BSD 2-Clause								(http://thejekels.com/cbtree/LICENSE)
//	2 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	3 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define(["dojo/_base/declare",
				"../error/createError!../error/StoreErrors.json"
        ], function (declare, createError) {
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

	var Ancestry = declare( null, {
		// summary:
		//		The Ancestry object is a collection of functions adding additional
		//		capabilities to the Hierarchy extension.

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
		}
		
	});	/* end declare() */

	return Ancestry;

});
