//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["./Keys",
		"./KeyRange",
		"./library",
		"../error/createError!../error/StoreErrors.json"
	], function (Keys, KeyRange, lib, createError) {
	"use strict";

	// module:
	//		indexedStore/_base/range
	// summary:

	var StoreError  = createError("Range");		// Create the StoreError type.
	var isDirection = lib.isDirection;

	function range(source, keyRange, direction, duplicates, keysOnly) {
		// summary:
		//		Retrieve the objects or keys in range of a given key range.
		// source: Store|Index
		//		Instance of Store or Index.
		// keyRange: Key|KeyRange?
		//		Key or key range defining the record or key range to retrieve.
		// direction: String?
		//		The range required direction. Valid options are: 'next', 'nextunique',
		//		'prev' or 'prevunique'. (default is 'next').
		// duplicates: Boolean?
		//		Determines if duplicate keys are allowed in the range. If false, all
		//		duplicate key entries are removed from the range. (default is true).
		// keysOnly: Boolean?
		//		If true, the record (object) keys are returned otherwise the objects
		//		(record values) are returned. (default is false).
		// returns: Object[]|Key[]
		//		An array of objects or key values. The order of the objects or keys
		//		is determined by the direction set for the range.
		// tag:
		//		Public

		if (!source || (source.type != "store" && source.type != "index")) {
			throw new StoreError("DataError", "constructor", "invalid source specified");
		}
		var direction  = direction || "next";
		var duplicates = duplicates != null ? !!duplicates : true;
		var store      = source.type == "store" ? source : source.store;
		var rangeDsc, records, results = [];

		if (!isDirection(direction)) {
			throw new StoreError("TypeError", "constructor", "invalid direction");
		}
		if (keyRange != null) {
			if (!(keyRange instanceof KeyRange)) {
				if (!Keys.validKey(keyRange)) {
					throw new StoreError("TypeError", "constructor");
				}
				keyRange = KeyRange.only(keyRange);
			}
			if (source.natural) {
				records = source._records.filter( function (record) {
					return Keys.inRange(record.key, keyRange);
				});
			} else {
				rangeDsc = Keys.getRange(source, keyRange);
				records  = source._records.slice(rangeDsc.first, rangeDsc.last+1);
			}
		} else {
			records = source._records.slice();
		}

		if (records.length) {
			var forward = /^next/.test(direction);
			var unique  = /unique$/.test(direction);
			var keys    = [];

			if (!forward) { records.reverse(); }
			if (source.type == "store") {
				results = records.map(function (record) {
					return keysOnly ? record.key : record.value;
				});
			} else {
				records.forEach(function (record) {
					var value = forward ? record.value : record.value.slice().reverse();
					keys = keys.concat(unique ? value[0] : value);
				});
				if (!duplicates) {
					// Remove all duplicate keys
					keys = Keys.purgeKey(keys);
				}
				if (!keysOnly) {
					results = keys.map(function (key) {
						return store._retrieveRecord(key).record.value;
					});
				} else {
					results = keys;
				}
			}
		}
		// Add range info to the result.
		results.direction = direction;
		results.keysOnly  = keysOnly;
		results.total     = results.length;

		return results;
	}	/* end range() */

	return range;
});	/* end define() */
