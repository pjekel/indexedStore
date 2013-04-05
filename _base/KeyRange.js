//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define(["../error/createError!../error/StoreErrors.json"], function (createError) {

	// module:
	//		store/_base/KeyRange
	// summary:
	//		This module implement the IndexedDB KeyRange object. The KeyRange object
	//		is identical to the IDBKeyRange object specified in the IndexedDB specs:
	//
	//			http://www.w3.org/TR/IndexedDB/#range-concept

	var StoreError   = createError( "KeyRange" );		// Create the StoreError type.
	var freezeObject = Object.freeze;

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
	
	KeyRange.only = function (/*any*/ value ) {
		// summary:
		//		Creates and returns a new key range with both lower and upper set
		//		to value and both lowerOpen and upperOpen set to false.
		// value:
		//		The only value.
		// tag:
		//		Public
		if (value || value == "") {
			var range = new KeyRange();
			return freezeObject( IDBKeyRange.call(range, value, value, false, false) );
		} else {
			throw new StoreError("PropertyMissing", "only", "key value required.");
		}
	};

	KeyRange.lowerBound = function (/*any*/ lower,/*Boolean*/ open ) {
		// summary:
		//		Creates and returns a new key range with lower set to lower, lowerOpen
		//		set to open, upper set to undefined and and upperOpen set to true.
		// lower:
		//		The lower bound value.
		// open:
		//		Set to false if the lower-bound should be included in the key range.
		//		Set to true if the lower-bound value should be excluded from the key
		//		range. Defaults to false (lower-bound value is included).
		// tag:
		//		Public
		if (lower || lower == "") {
			var range = new KeyRange();
			return freezeObject( IDBKeyRange.call(range, lower, undefined, !!open, false ) );
		} else {
			throw new StoreError("PropertyMissing", "lowerBound", "lower key value required.");
		}
	};

	KeyRange.upperBound = function (/*any*/ upper,/*Boolean*/ open ) {
		// summary:
		//		Creates and returns a new key range with lower set to undefined,
		//		lowerOpen set to true, upper set to upper and and upperOpen set
		//		to open.
		// upper:
		//		The upper bound value.
		// open:
		//		Set to false if the upper-bound should be included in the key range.
		//		Set to true if the upper-bound value should be excluded from the key
		//		range. Defaults to false (upper-bound value is included).
		// tag:
		//		Public
		if (upper || upper == "") {
			var range = new KeyRange();
			return freezeObject( IDBKeyRange.call(range, undefined, upper, false, !!open ) );
		} else {
			throw new StoreError("PropertyMissing", "upperBound", "upper key value required.");
		}
	};

	KeyRange.bound = function (/*any*/ lower,/*any*/ upper,/*Boolean*/ lowerOpen,/*Boolean*/ upperOpen ) {
		// summary:
		//		Creates and returns a new key range with lower set to lower, lowerOpen
		//		set to lowerOpen, upper set to upper and upperOpen set to upperOpen.
		// lower:
		//		The lower bound value.
		// upper:
		//		The upper bound value.
		// lowerOpen:
		//		Set to false if the lower-bound should be included in the key range.
		//		Set to true if the lower-bound value should be excluded from the key
		//		range. Defaults to false (lower-bound value is included).
		// upperOpen:
		//		Set to false if the upper-bound should be included in the key range.
		//		Set to true if the upper-bound value should be excluded from the key
		//		range. Defaults to false (upper-bound value is included).
		// tag:
		//		Public
		if ( (lower || lower == "") && (upper || upper == "")) {
			var range = new KeyRange();
			return freezeObject( IDBKeyRange.call(range, lower, upper, !!lowerOpen, !!upperOpen) );
		} else {
			throw new StoreError("PropertyMissing", "bound", "lower and upper key value required.");
		}
	};

	freezeObject(KeyRange);
	return KeyRange;

});