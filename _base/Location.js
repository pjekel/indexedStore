//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["./Keys"], function (Keys) {
	"use strict";

// module:
//		store/_base/Location
//

	var undef;
	
	function Location(/*Index|Store*/ source, ls, eq, gt, np ) {
		// summary:
		//		Record location object
		// description:
		//		A location object holds indexing (location) information for a given
		//		record key. The default location object looks like:
		//
		//		location dictionary = {
		//			position = 0;
		//			record = null;
		//			count = 0;
		//			ls = -1;
		//			eq = -1;
		//			gt = 0;
		//		};
		//
		//		position:
		//			Each record has a 'key' and 'value' property as in: {key, value}.
		//			In case of an index record the value represents the primary(s) key
		//			in the referenced object store. The value property of an index is
		//			implemented as an array allowing for multiple store records with
		//			the same index key. For example, an index record based on peoples
		//			last name could look like:
		//
		//				{ key: "simpson", value:["Abe", "Bart", "Homer", "Lisa"] };
		//
		//			When iterating an index cursor the position property identifies the
		//			current location (index) of the value property.
		//		record:
		//			Record reference. Depending on the source this is either an index
		//			or object store record. Typically the first record that matched a
		//			key search otherwise null.
		//		count:
		//			Number of record that matched a key.
		//		ls:
		//			The index of the last instance of a record whose key is less then
		//			the key searched for. (typically eq-1 if a match was found).
		//		eq:
		//			Index of the record with an exact key match. If no match is found
		//			eq equals -1.
		//		gt:
		//			The index of the first record whose key is greater then the key
		//			searched for.
		//		np:
		//			New position (used during cursor iteration).
		//
		// source:
		//		The location source which is either an Index or IDBOjectStore.
		//
		// tag:
		//		Public

		this.ls = (ls != undef ? ls : -1);
		this.eq = (eq != undef ? eq : -1);
		this.gt = (gt != undef ? gt :  0);

		this.record = (source._records && this.eq != -1) ? source._records[this.eq] : null;
		this.count  = this.gt > 0 ? this.gt - (this.ls + 1) : 0;
		this.position = np || 0;

		this.next = function (/*any?*/ key, /*Boolean?*/ unique) {
			// summary:
			//		Get the next record relative to the current location.
			// key:
			//		The next key to position this cursor at.
			// unique:
			//		If true records with duplicate keys are skipped.
			// returns:
			//		A location object.
			// tag:
			//		Private
			var eq = this.gt;

			if (key) {
				var keyLoc = Keys.search(source, key);
				var keyIdx = keyLoc.eq != -1 ? keyLoc.eq : keyLoc.ls + 1;
				if (keyIdx < eq) {
					return new Location( source, eq - 1, -1, 0 );
				} else {
					eq = keyIdx;
				}
			} else {
				if (!unique && (source.type == "index" && !source.unique)) {
					var storeKeys = source._records[this.eq].value;
					if (this.position < storeKeys.length - 1) {
						return new Location( source, this.ls, this.eq, this.gt, this.position + 1 );
					}
					this.position = 0;
				}
			}
			if (eq < source._records.length) {
				return new Location( source, eq - 1, eq, eq+1 );
			}
			return new Location( source, eq - 1, -1, eq );
		};

		this.previous = function (/*any?*/ key, /*Boolean?*/ unique) {
			// summary:
			//		Get the previous record relative to the current location.
			// key:
			//		The next key to position this cursor at.
			// unique:
			//		If true no records with duplicate keys are returned.
			// returns:
			//		A location object.
			// tag:
			//		Private
			var eq = this.ls;
			var np = 0;

			if (key) {
				var keyLoc = Keys.search(source, key);
				var keyIdx = keyLoc.eq != -1 ? keyLoc.eq : keyLoc.gt - 1;
				if (keyIdx > eq) {
					return new Location( source, eq - 1, -1, 0 );
				} else {
					eq = keyIdx;
				}
			} else {
				if (!unique && (source.type == "index" && !source.unique)) {
					var storeKeys = source._records[this.eq].value;
					if (this.position > 0) {
						return new Location( source, this.ls, this.eq, this.gt, this.position - 1 );
					}
				}
			}
			if (eq >= 0) {
				var np =  0;
				if (!unique && source.type == "index") {
					var storeKeys = source._records[eq].value;
					np = storeKeys.length - 1;
				}
				return new Location( source, eq - 1, eq, eq+1, np );
			}
			return new Location( source, eq - 1, -1, eq );
		};
	}

	return Location;
});