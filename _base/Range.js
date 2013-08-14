//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["exports",
		"./Keys",
		"./KeyRange",
		"./library",
		"../error/createError!../error/StoreErrors.json"
	], function (exports, Keys, KeyRange, lib, createError) {
	"use strict";

	// module:
	//		indexedStore/_base/range
	// summary:

	var StoreError  = createError("Range");		// Create the StoreError type.

	var RangeDirectives = {
		// direction: String?
		//		The range required direction. Valid options are: 'next', 'nextunique',
		//		'prev' or 'prevunique'. (default is 'next').
		direction: "next",

		// duplicates: Boolean?
		//		Determines if duplicate keys are allowed in the range. If false, all
		//		duplicate key entries are removed from the range. (default is true).
		duplicates: true
	};

	function referenceKeys(records, directives) {
		// summary:
		//		Get all store reference keys from a set of index records.
		// records: Records[]
		//		An array of index records.
		// directives: RangeDirectives
		// returns: Key[]
		//		An array of keys
		// tag:
		//		private
		var reverse = (/^prev/).test(directives.direction);
		var unique  = (/unique$/).test(directives.direction);
		var keys    = [];

		records.forEach(function (record) {
			// The value property of an index record is an array of store keys.
			var value = reverse ? record.value.slice().reverse() : record.value;
			keys = keys.concat(unique ? value[0] : value);
		});
		return directives.duplicates ? keys : Keys.purgeKey(keys);
	}

	exports.records = function (source, keyRange, options) {
		// summary:
		//		Retrieve all record within the given key range.
		// source: Store|Index|Records[]
		//		Instance of Store or Index or an array of records. If source is an
		//		array of records the records MUST be in ascending key order.
		// keyRange: Key|KeyRange?
		//		Key or key range defining the record or key range to retrieve.
		// options: RangeDirectives?
		//		A JavaScript key:value pairs object
		// returns: Record[]
		//		An array of Records
		// tag:
		//		public
		var direction  = (options && options.direction) || "next";
		var records    = source._records || source;
		var results    = [];
		var rangeDsc;

		if (!lib.isDirection(direction)) {
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
				results = records.filter( function (record) {
					return Keys.inRange(record.key, keyRange);
				});
			} else {
				rangeDsc = Keys.getRange(records, keyRange);
				results  = records.slice(rangeDsc.first, rangeDsc.last+1);
			}
		} else {
			results = records.slice();
		}
		if ((/^prev/).test(direction)) {
			results.reverse();
		}
		results.direction = direction;
		results.total     = results.length;
		return results;
	};

	exports.values = function (source, keyRange, options) {
		// summary:
		//		Retrieve all values within the given key range.
		// source: Store|Index|Records[]
		//		Instance of Store or Index or an array of records. If source is an
		//		array of records the records MUST be in ascending key order.
		// keyRange: Key|KeyRange?
		//		Key or key range defining the record or key range to retrieve.
		// options: RangeDirectives?
		//		A JavaScript key:value pairs object
		// returns: any[]
		//		An array of objects. Each object represent the value property of
		//		a store record.
		// tag:
		//		public
		var rangeOpts = lib.mixinOwn(null, RangeDirectives, options);
		var records   = exports.records(source, keyRange, rangeOpts);
		var refKeys, refStore, results = [];

		if (records.length) {
			if (source.baseClass == "index") {
				refKeys  = referenceKeys(records, rangeOpts);
				refStore = source.store;
				records  = refKeys.map(function (key) {
					return refStore._retrieveRecord(key).record;
				});
			}
			results = records.map(function (record) {
				return record.value;
			});
		}
		results.direction = rangeOpts.direction;
		results.total     = results.length;
		return results;
	}

	exports.keys = function (source, keyRange, options) {
		// summary:
		//		Retrieve all key values within the given key range.
		// source: Store|Index|Records[]
		//		Instance of Store or Index or an array of records. If source is an
		//		array of records the records MUST be in ascending key order.
		// keyRange: Key|KeyRange?
		//		Key or key range defining the record or key range to retrieve.
		// options: RangeDirectives?
		//		A JavaScript key:value pairs object
		// returns: any[]
		//		An array of Keys. Each key represents the key property of a store
		//		record.
		// tag:
		//		public
		var rangeOpts = lib.mixinOwn(null, RangeDirectives, options);
		var records   = exports.records(source, keyRange, rangeOpts);
		var results   = [];

		if (records.length) {
			if (source.baseClass == "index") {
				results = referenceKeys(records, rangeOpts);
			} else {
				results = records.map(function (record) {
					return record.key;
				});
			}
		}
		results.direction = rangeOpts.direction;
		results.total     = results.length;
		return results;
	}
	return exports;
});	/* end define() */
