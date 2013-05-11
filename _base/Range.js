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
				"./KeyRange",
				"./Library",
				"../error/createError!../error/StoreErrors.json",
			 ], function (Keys, KeyRange, Lib, createError) {

	var StoreError = createError( "Range" );		// Create the StoreError type.
	var isObject = Lib.isObject;
	var clone    = Lib.clone;
	var undef;
	
	function Range(source, keyRange, direction, duplicates, keysOnly) {
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
		//		Detrmines if duplicate keys are allowed in the range. If false, all
		//		duplicate key entries are removed from the range. (default is true).
		// keysOnly: Boolean?
		//		If true, the record (object) keys are returned otherwise the objects
		//		(record values) are returned. (default is false).
		// returns: Object[]|Key[]
		//		An array of objects or key values. The order of the objects or keys
		//		is determined by the direction.
		// tag:
		//		Public

		if (source && (source.type == "store" || source.type == "index")) {
			var direction  = direction || "next";
			var ascending  = /^next/.test(direction) || false;
			var unique     = /unique$/.test(direction) || false;
			var duplicates = duplicates != undef ? !!duplicates : true;
			var keysOnly   = keysOnly != undef ? !!keysOnly : false;
			var store      = source.type == "store" ? source : source.store;
			var results    = [];
			
			if (!Lib.isDirection( direction )) {
				throw new StoreError( "TypeError", "constructor", "invalid direction");
			}
			if (!(keyRange instanceof KeyRange)) {
				if (keyRange != undef) {
					if (!Keys.validKey(keyRange)) {
						throw new StoreError( "TypeError", "constructor" );
					}
					keyRange = KeyRange.only( source.uppercase ? Keys.toUpperCase(keyRange) : keyRange );
				}
			}			
			var records, value, range, keys = [];
			// In case of a Natural store we have to iterate all records.
			if (source.type == "store" && source.features.has("natural")) {
				records = source._records.filter( function (record) {
					return Keys.inRange( record.key, keyRange );
				});
			} else {
				range   = Keys.getRange( source, keyRange );
				records = source._records.slice(range.first, range.last+1);
			}
			if (records.length) {
				if (!ascending) { records.reverse();}
				switch (source.type) {
					case "store":
						results = records.map( function (record) {
							value = keysOnly ? record.key : record.value;
							return source._clone ? clone(value) : value;
						});
						break;
					case "index":
						records.forEach( function (record) {
							var value = ascending ? record.value : record.value.slice().reverse();
							keys = keys.concat( unique ? value[0] : value );
						});
						if (!duplicates) {
							// Remove all duplicate keys
							keys = Keys.purgeKey(keys);
						}
						results = keys.map( function (key) {
							return keysOnly ? (store._clone ? clone(key) : key) : store.get(key);
						});
						break;
				};	/* end switch() */
			}
			results.direction = direction;
			results.revision  = store.revision;
			results.keyRange  = keysOnly;
			return results;
		} else {
			throw new StoreError("DataError", "constructor", "invalid source specified");
		}
	}	/* end Range() */

	return Range;

});	/* end define() */
