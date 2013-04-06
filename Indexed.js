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
				"./extension/Loader"
			 ], function (declare, _Store, _Indexed, Loader) {
	"use strict";
	// module:
	//		store/Hierarchy
	// summary:

	return declare( [_Store, _Indexed, Loader] );
});
