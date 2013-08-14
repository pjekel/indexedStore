//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../shim/Object"], function () {
	"use strict";

	// module
	//		indexedStore/_base/opcodes
	// summary:
	//		Declare the store operation codes.  Operation keys MUST be all uppercase
	//		characters and the associated value MUST be a valid JavaScript identifier
	//		and unique.

	var values = [];
	var opcodes = {
		NEW    : 0,
		DELETE : 1,
		UPDATE : 2,
		CLEAR  : 3,
		CLOSE  : 4
	};

	opcodes.isOpcode = function (value) {
		// summary:
		//		Test if a given value equals any known opcode value.
		// value: String|Number
		// returns: Boolean
		// tag:
		//		public
		return value ? (values.indexOf(value) != -1) : false;
	};
	
	opcodes.keys = function () {
		// summary:
		//		Get all uppercase keys.
		// returns: String[]
		// tag:
		//		public
		return Object.keys(opcodes).filter(function (key) {
			return (/^[A-Z]+$/).test(key);
		})
	};

	opcodes.name = function (opcode) {
		// summary:
		//		Return the symbolic name associated with a operation code.
		// opcode: String|Number
		// returns: String
		// tag:
		//		public
		var name;
		opcodes.keys().some(function (key) {
			if (opcodes[key] === opcode) {
				name = key;
				return true;
			}
		});
		return name;
	}

	opcodes.toArray = function () {
		// summary:
		//		Return all opcode values as an array
		// returns: Array
		// tag:
		//		public
		return opcodes.keys().map(function (key) {
			return opcodes[key];
		});
	};

	opcodes.toString = function () {
		// summary:
		//		Serialize the opcode values.
		// returns: String
		//		A comma separated string.
		// tag:
		//		public
		return values.join(",");
	};

	// Store opcode values as a separate array to improve performance on things
	// like toString() and isOpcode().
	values = opcodes.toArray();

	return Object.freeze(opcodes);
});	/* end define() */
