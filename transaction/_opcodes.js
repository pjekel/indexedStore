//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../shim/Object"], function () {
	// module
	//		indexedStore/transaction/_opcodes
	// summary:
	
	var opNames = ["new", "delete", "update", "clear", "createIndex", "deleteIndex"];
	var opcodes = {
		// Declare transaction states
		IDLE: 0,
		PENDING: 1,
		ACTIVE: 2,
		DONE: 4,

		// Declare operation types
		NEW: 0,
		DELETE: 1,
		UPDATE: 2,
		CLEAR: 3,
		CREATE_INDEX: 4,
		DELETE_INDEX: 5,

		name: function (code) {
			return opNames[code];
		}
	};
	
	return Object.freeze(opcodes);
})	/* end define() */
