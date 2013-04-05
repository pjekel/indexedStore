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
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, createError) {
	"use strict";
	
	var StoreError = createError( "Hierarchy" );		// Create the StoreError type.
	
	// module:
	//		store/extension/Hierarchy
	// summary:

	var Hierarchy = declare( null, {

		//=========================================================================
		// Hierarchy Properties

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

		//=========================================================================

		// hierarchical: Boolean [read-only]
		//		Indicates this store is capable of maintaining an object hierarchy.
		//		The cbtree Models tests for the presence of this property in order to
		//		determine if it has to set the parent property of an object or if the
		//		store will handle it.
		hierarchical: true,

		//=========================================================================
		// Public store/api/store API methods

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
		},

		hasChildren: function(/*Object*/ parent) {
			// summary:
			//		Test if a parent object has known children.	
			// parent: Object
			// returns: Boolean
			//		 true if the parent object has known children otherwise false.
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
		}

	});	/* end declare() */
	
	return Hierarchy;

});	/* end define() */
