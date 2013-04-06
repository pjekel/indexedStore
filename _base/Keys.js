//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["exports", 
				"./Library", 
				"./Location",
				"../error/createError!../error/StoreErrors.json"
			 ], function(exports, Lib, Location, createError) {
	"use strict";

	// module:
	//		store/_base/keys
	// summary:
	//		The Keys module implements all the functionality required to handle
	//		IndexedDB keys and key ranges. For detailed information on keys and
	//		key ranges please refer to:
	//
	//			http://www.w3.org/TR/IndexedDB/#key-construct
	//			http://www.w3.org/TR/IndexedDB/#range-concept
	//
	//		The KeyRange object is implemented by a separate model:
	//
	//			store/_base/KeyRange

	var StoreError = createError( "Keys" );			// Create the StoreError type.
	var undef;
	
	function cmpAry( ary1, ary2 ) {
		//summary:
		//		Deep array comparison. Non-numeric properties are ignored.
		var min = (ary1.length < ary2.length ? ary1.length : ary2.length);
		var res = 0, i;
		
		for (i = 0; !res && i<min; i++) {
			res = exports.cmp( ary1[i], ary2[i]);
		}
		if (!res && ary1.length != ary2.length) {
			return (ary1.length < ary2.length ? -1 : 1);
		}
		return res;
	}

	exports.cmp = function cmp ( key1, key2 ) {
		// summary:
		//		This method compares two keys. The method returns 1 if the first key
		//		is greater than the second, -1 if the first is less than the second,
		//		and 0 if the first is equal to the second.  By IndexedDB definition
		//		the following condition is always true:
		//
		//			Array > String > Date > Number
		//
		//		(See http://www.w3.org/TR/IndexedDB/#key-construct)
		// key1:
		//		First valid indexedDB key.
		// key2:
		//		Second valid indexedDB key.
		// returns:
		//		-1, 0 or 1
		// tag:
		//		Public.

		// Handle 'undefined' same as null but preserve any empty strings.
		var keyA = key1 != undef ? key1 : null;
		var keyB = key2 != undef ? key2 : null;

		// Explicitly test for null so comparing the 'empty string' works correct.
		if (keyA !== null && keyB !== null) {
			if (keyA instanceof Array || keyB instanceof Array) {
				if (!(keyA instanceof Array)) return -1;
				if (!(keyB instanceof Array)) return 1;
				return cmpAry( keyA, keyB );	// Perform deep array comparison.
			}
			if (typeof keyA === typeof keyB) {
				if (keyA < keyB) return -1;
				if (keyA > keyB) return 1;
				return 0;
			} else if (keyA instanceof String || typeof keyA == "string") {
				return 1;
			} else if (keyB instanceof String || typeof keyB == "string") {
				return -1;
			} else if (keyA instanceof Date) {
				return 1;
			} else if (keyB instanceof Date) {
				return -1;
			}
			// Getting here actually implies invalid key values. (unsupported types).
			return exports.cmp( keyA.toString(), keyB.toString() );
		}
		if (!keyA && !keyB) return 0;
		if (!keyA) return -1;
		return 1;
	};

	exports.boundary = function (/*Index|Store*/ source, /*any*/ key, /*String*/ type, /*Boolean*/ open ) {
		// summary:
		//		Determine the upper or lower boundary of an ordered list of records
		//		sharing the same key.
		// source:
		//		The source to search which is either an Index or Store.
		// key:
		//		Key for which the boundary is to be determined.
		// type:
		//		Boundary type: 'lower' or 'upper'
		// open:
		//		Indicates if the key itself is to be included or excluded when setting
		//		the boundary. If open is set to false matching key records will be
		//		included otherwise they are excluded.
		// returns:
		//		Record index. If boundary equals 'lower' the index identifies the
		//		lower boundary or first record otherwise it is the upper boundary or
		//		last record.
		// tag:
		//		Public
		var records = source._records;
		var max     = records.length;
		var result;

		if (key) {
			var entry = exports.search(source, key);
			var index = entry.eq >= 0 ? entry.eq : entry.gt;
			for( ; index < max; index++) {
				result = exports.cmp( key, records[index].key );
				switch (type) {
					case "lower":
						if (result == 0 && !open) {
							return index;
						}
						if (result < 0) {
							return index;
						}
						continue;

					case "upper":
						if (result == 0 && open) {
								return index-1;
						}
						if (result < 0) {
							return index-1;
						}
						continue;
				}
			}
			return max;
		} else {
			switch (type) {
				case "lower":
					return 0;
				case "upper":
					return max;
			}
		}
	};

	exports.getKey = function (/*Store*/ store,/*Object*/ value,/*any?*/ key ) {
		// summary:
		//		Get the key from the value using a key path (in-line-key), the
		//		optional provided key (out-of-line key) or generate a key.
		// value:
		//		JavaScript key:value pairs object.
		// key:
		//		Optional, key
		// returns:
		//		Key value.
		// tag:
		//		Private

		var inline = false;
		if (store.keyPath || store.keyPath == "") {
			if (key) {
				throw new StoreError("DataError", "getKey", "both keyPath and optional key specified");
			}
			key = exports.keyValue(store.keyPath, value);
			inline = true;
		}
		
		if (key) {
			if (exports.validKey(key)) {
				if (store.autoIncrement && typeof key == "number") {
					if (key > store._autoIndex) {
						store._autoIndex = Math.floor(key+1);
					}
				}
			} else {
				throw new StoreError("TypeError", "hasKey", "invalid key value: [%{0}]", key);
			}
		} else {
			if (!store.autoIncrement) {
				throw new StoreError("DataError", "_storeRecord", "unable to obtain or generate a key");
			}
			key = store._autoIndex = (store._autoIndex ? store._autoIndex++ : 1);
		}
		// If the key is out-of-line or was generated AND the store has a key path
		// assign the new key value to the key path property.
		if (!inline && store.keyPath) {
			Lib.setProp( store.keyPath, key, value );
		}
		return key;
	},

	exports.getRange = function (/*Index|Store*/ source, /*KeyRange*/ keyRange) {
		// summary:
		//		Determine all records within a given key range.
		// source:
		//		An index or a store with their records in ascending key order.
		// keyRange:
		//		A KeyRange object
		// returns:
		//		A Range object.
		// tag:
		//		Public

		function Range (source, first, last) {
			// Compose a Range object.
			var max  = source ? source._records.length : 0;
			var last = Math.min(last, max);
			
			if (last >= 0 && (first > -1 && first <= last && first < max)) {
				this.first  = first;
				this.last   = max > 0 ? Math.min(last, max-1)  : 0;
				this.length = Math.max( (last - first), 1 );
				this.record = source._records[first];
			} else {
				this.record = null;
				this.length = 0;
				this.first  = -1;
				this.last   = -1;
			}
			this.source = source;
		}

		var records = source ? source._records : null;
		var first = -1, last = -1;

		if (keyRange && records.length) {
			first = exports.boundary( source, keyRange.lower, "lower", keyRange.lowerOpen);
			last  = exports.boundary( source, keyRange.upper, "upper", keyRange.upperOpen);
		}
		return new Range(source, first, last);		// return a range object
	};

	exports.indexKeyValue = function (/*String|String[]*/  keyPath, /*Object*/ value ) {
		// summary:
		//		Extract the index key value from an object. If the index key is an array
		//		any invalid keys and/or duplicate elements are removed
		// keyPath:
		//		A key path is a DOMString that defines how to extract a key from a value.
		//		A valid key path is either the empty string, a JavaScript identifier, or
		//		multiple JavaScript identifiers separated by periods. (Note that spaces
		//		are not allowed within a key path.)
		// value:
		//		Object to extract the key value from.
		// returns:
		//		Any.
		// tag:
		//		Public
		var keyValue = exports.keyValue( keyPath, value );
		if (keyValue instanceof Array) {
			var unique = {};
			keyValue = keyValue.filter(function(item) {
				if (item && !unique[item]) {
					unique[item] = true;
					return true;
				}
			});
			return keyValue.length ? keyValue : undefined;
		} else {
			if (keyValue !== null && keyValue !== undefined) {
				return keyValue;
			}
		}
	};

	exports.indexOf = function (/*Key[]*/ keyArray,/*Key*/ key) {
		// summary:
		//		Returns the first index at which a given element can be found in an
		//		array of keys, or -1 if it is not present.
		// keyArray:
		//		Array to search in.
		// key:
		//		Key to locate in the array.
		// returns:
		//		First index if found otherwise -1.
		// tag:
		//		Public
		var index = -1;
		if (key && keyArray instanceof Array) {
			keyArray.some( function(aryKey, idx) {
				if (!exports.cmp(key, aryKey)) {
					index = idx;
					return true;
				}
			});
		}
		return index;
	};
	
	exports.inRange = function (/*any*/ key, /*KeyRange*/ keyRange) {
		// summary:
		//		Validate if key is within a key range. A key is considered to be in
		//		range if both the following conditions are fulfilled:
		//
		//		• The key range lower value is undefined or less than key. It may also
		//			be equal to key if lowerOpen is false.
		//		• The key range upper value is undefined or greater than key. It may
		//			also be equal to key if upperOpen is false.
		//
		// key:
		//		Key to be evaluated.
		// keyRange:
		//		A KeyRange.
		// returns:
		//		Boolean, true if key is in range otherwise false.
		// tag:
		//		Public

		if (exports.validKey(key)) {
			var lwKey = keyRange.lower || "";
			var upKey = keyRange.upper || "";
			var lower = exports.cmp(lwKey, key);
			var upper = exports.cmp(upKey, key);

			if ( ((lwKey == "" || lower < 0) || (lower == 0 && !keyRange.lowerOpen)) &&
					 ((upKey == "" || upper > 0) || (upper == 0 && !keyRange.upperOpen)) ) {
				return true;
			}
		}
		return false;
	};

	exports.keyValue = function (/*String|String[]*/ keyPath,/*object*/ object ) {
		// summary:
		//		Extract the (primary) key value from an object using a key path.
		// keyPath:
		//		A key path is a DOMString that defines how to extract a key from a value.
		//		A valid key path is either the empty string, a JavaScript identifier, or
		//		multiple Javascript identifiers separated by periods. (Note that spaces
		//		are not allowed within a key path.)
		// object:
		//		Object to extract the key value from.
		// returns:
		//		Any. The value returned may or may not be a valid key. (see also 
		//		validKey() and indexKeyalue() )
		// tag:
		//		Public
		var keyValue;

		if (keyPath instanceof Array) {
			return keyPath.map( function (path) {
				return exports.keyValue(path,object);
			});
		} else if (keyPath != "") {
			return Lib.getProp(keyPath, object);
		} else {
			return object;
		}

	};

	exports.rangeToLocation = function (range) {
		// summary:
		//		Convert a range object to a location object. The location of the first
		//		record in the range is returned.
		// range:
		//		The Range object to be converted.
		// tag:
		//		Public

		if (range && range.record) {
			// return the location of the first record.
			return exports.search( range.source, range.record.key );
		}
		return new Location (range.source);
	};

	exports.search = function search (/*Index|Store*/ source, /*any*/ key ) {
		// summary:
		//		Search in an ordered list of records all records that share key and
		//		return a location object.
		// records:
		//		List of records in ascending order by key.
		// key:
		//		Key identifying the record(s).
		// returns:
		//		A location object.
		// tag:
		//		Public
		var records = source._records;

		if (records && records.length) {
			var lb = 0, ub = records.length;		// Set boundaries
			var idx, rc;

			do {
				idx = lb + Math.floor((ub-lb)/2);
				rc  = exports.cmp( key, records[idx].key )
				switch (rc) {
					case 0:
						return new Location( source, idx-1, idx, idx+1 );
					case 1:
						lb = idx + 1;
						break;
					case -1:
						ub = idx;
						break;
				}
			} while (lb < ub);
			return new Location( source, (rc < 0 ? idx-1 : idx), -1, (rc < 0 ? idx : idx + 1));
		}
		return new Location(source);
	};

	exports.validKey = function (/*any*/ key) {
		// summary:
		//		Valid if key is a valid indexedDB key
		// key:
		//		Key to be validated.
		// returns:
		//		Boolean, true if a valid key otherwise false.
		// tag
		//		Public
		if (key) {
			if (key instanceof Array) {
				return key.every( exports.validKey );
			}
			return (typeof key === "string" ||
							 typeof key === "number" ||
							 key instanceof Date);
		}
		return false;
	};
	
	exports.validPath = function (/*KeyPath*/ keyPath) {
		// summary:
		//		Validate if key path is valid. Note: A key path can be an array
		//		but not nested.
		// keyPath:
		//		KeyPath to be validated.
		// returns:
		//		Boolean, true if a valid path otherwise false.
		// tag
		//		Public
		
		function splitPath (keyPath) {
			if (typeof keyPath == "string") {
				var properties = keyPath.split(".");
				return properties.every( function (prop) {
					return (/^[_$A-Za-z]/.test(prop) && !/\s/.test(prop));
				});
			}
			return false;
		}
		
		if (keyPath != "") {
			if (keyPath instanceof Array) {
				return keyPath.every( splitPath );
			}
			return splitPath(keyPath);
		}
		return true;
	};

	return exports;
});