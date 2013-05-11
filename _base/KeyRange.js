//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["./Keys",
				"../error/createError!../error/StoreErrors.json"
			 ], function (Keys, createError) {

	// module:
	//		IndexedStore/_base/KeyRange
	// summary:
	//		This module implement the IndexedDB KeyRange object. The KeyRange object
	//		is identical to the IDBKeyRange object specified in the IndexedDB specs:
	//
	//			http://www.w3.org/TR/IndexedDB/#range-concept
	//
	//	However, if a native IDBKeyRange implementation is available it will be
	//	used instead.
	
	var StoreError   = createError( "KeyRange" );		// Create the StoreError type.
	var freezeObject = Object.freeze;

	// Test if a native IDBKeyRange implementation is available
	var nativeKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange ||
                       window.mozIDBKeyRange || window.msIDBKeyRange;
	if (nativeKeyRange) {
		return nativeKeyRange;
	}

	function IDBKeyRange (lower, upper, lowerOpen, upperOpen) {
		this.lower = lower
		this.lowerOpen = lowerOpen || false;
		this.upper = upper;
		this.upperOpen = upperOpen || false;

		return this;
	}

	function KeyRange () {}

	// Setup the prototype so instanceof work properly.
	// example:
	//		var abc = KeyRange.only("homer");
	//		if (abc instanceof KeyRange) {
	//						...
	//		}
	KeyRange.prototype = new IDBKeyRange();
	KeyRange.prototype.constructor.prototype = IDBKeyRange.prototype;
	
	KeyRange.only = function (value) {
		// summary:
		//		Creates and returns a new key range with both lower and upper set
		//		to value and both lowerOpen and upperOpen set to false.
		// value: Key
		//		The only value.
		// tag:
		//		Public
		if (Keys.validKey(value)) {
			var range = new KeyRange();
			return freezeObject( IDBKeyRange.call(range, value, value, false, false) );
		}
		throw new StoreError("DataError", "only");
	};

	KeyRange.lowerBound = function (lower, open) {
		// summary:
		//		Creates and returns a new key range with lower set to lower, lowerOpen
		//		set to open, upper set to undefined and and upperOpen set to true.
		// lower: Key
		//		The lower bound value.
		// open: Boolean?
		//		Set to false if the lower-bound should be included in the key range.
		//		Set to true if the lower-bound value should be excluded from the key
		//		range. Defaults to false (lower-bound value is included).
		// tag:
		//		Public
		if (Keys.validKey(lower)) {
			var range = new KeyRange();
			return freezeObject( IDBKeyRange.call(range, lower, undefined, !!open, false ) );
		}
		throw new StoreError("DataError", "lowerBound");
	};

	KeyRange.upperBound = function (upper, open) {
		// summary:
		//		Creates and returns a new key range with lower set to undefined,
		//		lowerOpen set to true, upper set to upper and and upperOpen set
		//		to open.
		// upper: Key
		//		The upper bound value.
		// open: Boolean?
		//		Set to false if the upper-bound should be included in the key range.
		//		Set to true if the upper-bound value should be excluded from the key
		//		range. Defaults to false (upper-bound value is included).
		// tag:
		//		Public
		if (Keys.validKey(upper)) {
			var range = new KeyRange();
			return freezeObject( IDBKeyRange.call(range, undefined, upper, false, !!open ) );
		}
		throw new StoreError("DataError", "upperBound");
	};

	KeyRange.bound = function (lower, upper, lowerOpen, upperOpen ) {
		// summary:
		//		Creates and returns a new key range with lower set to lower, lowerOpen
		//		set to lowerOpen, upper set to upper and upperOpen set to upperOpen.
		// lower: Key
		//		The lower bound value.
		// upper: Key
		//		The upper bound value.
		// lowerOpen: Boolean?
		//		Set to false if the lower-bound should be included in the key range.
		//		Set to true if the lower-bound value should be excluded from the key
		//		range. Defaults to false (lower-bound value is included).
		// upperOpen: Boolean?
		//		Set to false if the upper-bound should be included in the key range.
		//		Set to true if the upper-bound value should be excluded from the key
		//		range. Defaults to false (upper-bound value is included).
		// tag:
		//		Public
		if ( Keys.validKey(lower) && Keys.validKey(upper)) {
			if (Keys.cmp(lower, upper) <= 0) {
				var range = new KeyRange();
				return freezeObject( IDBKeyRange.call(range, lower, upper, !!lowerOpen, !!upperOpen) );
			} else {
			}
		}
		throw new StoreError("DataError", "bound");
	};

	freezeObject(KeyRange);
	return KeyRange;

});