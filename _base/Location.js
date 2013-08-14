//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define([], function () {
	"use strict";

	// module:
	//		IndexedStore/_base/Location
	//
	// interface:
	//		[Constructor(sequence<Record> records, optional long ls = -1, optional long eq = -1, optional long gt = 0)]
	//		interface Location {
	//			attribute number	ls;
	//			attribute number	eq;
	//			attribute number	gt;
	//			attribute object	record;
	//			attribute any		key;
	//			attribute any		value;
	//		};

	function Location(source, ls, eq, gt) {
		// summary:
		//		A Record location object holds indexing (location) information for a
		//		given record.
		// Source: Store|Index|Record[]
		//		Instance of Store or Index or an array of records.
		// ls: Number?
		//		The index of the last instance of a record whose key is less then
		//		the key searched for. (typically eq - 1 if a match was found).
		// eq: Number?
		//		Index of the record with an exact key match. If no match is found
		//		eq equals -1 and the record property will be null.
		// gt: Number?
		//		The index of the first record whose key is greater then the key
		//		searched for.
		// returns: Location
		//		A new instance of a Location object.
		// tag:
		//		Public
		var records = source._records || source;

		this.ls = (ls != null ? ls : -1);
		this.eq = (eq != null ? eq : -1);
		this.gt = (gt != null ? gt :  0);

		this.record = this.eq != -1 ? records[this.eq] : null;
		this.value  = this.record && this.record.value;
		this.key    = this.record && this.record.key;
	}
	return Location;
});