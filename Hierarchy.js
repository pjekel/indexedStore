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
				"./_base/_Store",
				"./_base/_Indexed",
				"./_base/_Loader",
				"./extension/Hierarchy"
			 ], function (declare, _Store, _Indexed, _Loader, Hierarchy) {
	"use strict";
	// module:
	//		store/Hierarchy
	// summary:

	return declare( [_Store, _Indexed, _Loader, Hierarchy] );
});
