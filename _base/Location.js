//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define([], function () {
	"use strict";

// module:
//		IndexedStore/_base/Location
//

	var undef;

	function Location(source, ls, eq, gt ) {
		// summary:
		//		A Record location object holds indexing (location) information for a
		//		given record. The default location object looks like:
		//
		//		location dictionary = {
		//			record = null;
		//			value = null;
		//			key = null
		//			ls = -1;
		//			eq = -1;
		//			gt = 0;
		//		};
		//
		// source: Store|Index
		//		The location source which is either an Index or IDBOjectStore.
		// ls: Number?
		//		The index of the last instance of a record whose key is less then
		//		the key searched for. (typically eq-1 if a match was found).
		// eq: Number?
		//		Index of the record with an exact key match. If no match is found
		//		eq equals -1.
		// gt: Number?
		//		The index of the first record whose key is greater then the key
		//		searched for.
		// returns: Location
		//		A new instance of a Location object.
		// tag:
		//		Public

		this.ls = (ls != undef ? ls : -1);
		this.eq = (eq != undef ? eq : -1);
		this.gt = (gt != undef ? gt :  0);

		this.record = this.eq != -1 ? source._records[this.eq] : null;
		this.value  = this.record && this.record.value;
		this.key    = this.record && this.record.key;
	}
	return Location;
});