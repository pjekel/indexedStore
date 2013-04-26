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
				"./_base/_Store",
				"./_base/_Natural",
				"./extension/Loader"
			 ], function (declare, _Store, _Natural, Loader) {
	"use strict";
	// module:
	//		store/Memory
	// summary:

	return declare( [_Store, _Natural, Loader] );
});
