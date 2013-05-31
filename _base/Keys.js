//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["exports", 
				"./Library", 
				"./Location",
				"../error/createError!../error/StoreErrors.json"
			 ], function(exports, Lib, Location, createError) {
	"use strict";

	// module:
	//		IndexedStore/_base/keys
	// summary:
	//		The Keys module implements all the functionality required to handle
	//		IndexedDB keys and key ranges. For detailed information on keys and
	//		key ranges please refer to:
	//
	//			http://www.w3.org/TR/IndexedDB/#key-construct
	//			http://www.w3.org/TR/IndexedDB/#range-concept
	//
	//		The KeyRange object is implemented by:
	//
	//			IndexedStore/_base/KeyRange

	var StoreError = createError( "Keys" );			// Create the StoreError type.
	var isString   = Lib.isString;
	var getProp    = Lib.getProp;
	var clone      = Lib.clone;
	var undef;
	
	exports.cmp = function cmp ( key1, key2, strict ) {
		// summary:
		//		This method compares two keys. The method returns 1 if the first key
		//		is greater than the second, -1 if the first is less than the second,
		//		and 0 if the first is equal to the second.  By IndexedDB definition
		//		the following condition is always true:
		//
		//			Array > String > Date > Number
		//
		//		(See http://www.w3.org/TR/IndexedDB/#key-construct)
		// key1: Any
		//		First valid indexedDB key.
		// key2: Any
		//		Second valid indexedDB key.
		// returns: Number
		//		-1, 0 or 1
		// NOTE:
		//		When comparing dates the time portion of the date objects is ignored.
		//		If the time is relevant call cmp() as follows:
		//
		//			cmp( date1.getTime(), date2.getTime() )
		//
		// tag:
		//		Public.

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

		// Handle 'undefined' same as null but preserve any empty strings.
		var keyA = key1 != undef ? key1 : null;
		var keyB = key2 != undef ? key2 : null;

		if (keyA != null && keyB != null) {
			if (typeof keyA == typeof keyB) {
				if (keyA instanceof Array) {
					return cmpAry( keyA, keyB );	// Perform deep array comparison.
				}
				// Expliticly test if KeyA equals KeyB, this because two distinct objects
				// are never the same. Trying to compare objects will throw an exception 
				// of type TypeError.
				if (keyA > keyB) return  1;
				if (keyA < keyB) return -1;
				if (keyA == keyB) return 0;
			}
			if (keyA instanceof Array) return  1;
			if (keyB instanceof Array) return -1;

			if (keyA instanceof String || typeof keyA =="string") return  1;
			if (keyB instanceof String || typeof keyB =="string") return -1;

			if (keyA instanceof Date) return  1;
			if (keyB instanceof Date) return -1;

			throw new StoreError("TypeError", "cmp");
		}
		// Although null is not a valid key, allow it so this function can be used
		// for  more than just key comparison.
		if (!strict) {
			if (!keyA && !keyB) return 0;
			if (!keyA) return -1;
			return 1;
		}
		throw new StoreError("TypeError", "cmp");
	};

	exports.boundary = function (source, key, type, open ) {
		// summary:
		//		Determine the upper or lower boundary of an ordered list of records
		//		sharing the same key.
		// source: Store|Index
		//		The source to search which is either an Index or Store.
		// key: Key
		//		Key for which the boundary is to be determined.
		// type: String
		//		Boundary type: 'lower' or 'upper'
		// open: Boolean
		//		Indicates if the key itself is to be included or excluded when setting
		//		the boundary. If open is set to false matching key records will be
		//		included otherwise they are excluded.
		// returns: Number
		//		Record index. If boundary equals 'lower' the index identifies the
		//		lower boundary or first record otherwise it is the upper boundary or
		//		last record.
		// tag:
		//		Public
		var records = source ? source._records : [];
		var max     = records.length;

		if (key == undef) {
			return type == "lower" ? 0 : max;
		}
		
		var entry = exports.search(source, key);
		var index = entry.eq >= 0 ? entry.eq : entry.gt;
		var result;
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
	};

	exports.getKey = function (store, value, key) {
		// summary:
		//		Get the key from the value using a key path (in-line-key), the
		//		optional provided key (out-of-line key) or generate a key.
		// store: Store
		// value: Object
		//		JavaScript key:value pairs object.
		// key: Key?
		//		Key to be assigned if no key value can be extracted from the object.
		//		Only allowed if the store has no key path defined.
		// returns: Key
		//		Key value.
		// tag:
		//		Private

		var inline = false;
		if (store.keyPath != undef) {
			if (key != undef) {
				throw new StoreError("DataError", "getKey", "both keyPath and optional key specified");
			}
			if (key = exports.keyValue(store.keyPath, value)) {
				inline = true;
			}
		}
		if (key != undef) {
			if (exports.validKey(key)) {
				if (store.autoIncrement && typeof key == "number") {
					if (key >= store._autoIndex) {
						store._autoIndex = Math.floor(key+1);
					}
				}
			} else {
				throw new StoreError("DataError", "getKey", "invalid key value: [%{0}]", key);
			}
		} else {
			if (!store.autoIncrement) {
				throw new StoreError("DataError", "getKey", "unable to obtain or generate a key");
			}
			key = store._autoIndex++;
		}
		// If the key is out-of-line or was generated AND the store has a key path
		// assign the new key value to the key path property assuming 'value' is 
		// an object or array.
		if (!inline && store.keyPath) {
			if (Lib.isObject(value) || value instanceof Array) {
				Lib.setProp( store.keyPath, key, value );
			} else {
				throw new StoreError("DataError", "getKey", "value must be an object or array");
			}
		}
		return key;
	},

	exports.getRange = function (source, keyRange) {
		// summary:
		//		Determine all records within a given key range. This function does
		//		not return records, instead it returns a Range object which holds
		//		information about the first and last record in range.
		// source: Store|Index
		//		An index or a store with their records in ascending key order.
		// keyRange: KeyRange
		//		A KeyRange object
		// returns: Range
		//		A Range object.
		// tag:
		//		Public

		function Range (source, first, last) {
			// summary:
			// 		Compose a Range object.
			// source: Store|Index
			// first: Number
			//		Index number of the first record in range.
			// last:  number
			//		Index number of the last record in range.
			// returns: Range
			//		A Range object
			// tag:
			//		Private
			var max  = source._records.length;
			var last = Math.min(last, max);
			
			if (last >= 0 && (first > -1 && first <= last && first < max)) {
				this.first  = first;
				this.last   = max > 0 ? Math.min(last, max-1)  : 0;
				this.length = (this.last - this.first) + 1;
				this.record = source._records[first];
			} else {
				this.record = null;
				this.length = 0;
				this.first  = -1;
				this.last   = -1;
			}
			this.source = source;
		}

		if (source) {
			var records = source._records;
			var first = -1, last = -1;

			if (records.length) {
				if (keyRange) {
					first = exports.boundary( source, keyRange.lower, "lower", keyRange.lowerOpen);
					last  = exports.boundary( source, keyRange.upper, "upper", keyRange.upperOpen);
				} else {
					return new Range(source, 0, records.length);
				}
			}
			return new Range(source, first, last);		// return a range object
		}
		throw new StoreError("ParameterError", "getRange");
	};

	exports.indexOf = function (keyArray, key, fromIndex) {
		// summary:
		//		Returns the first index at which a given key can be found in the key
		//		array, or -1 if it is not present.
		// keyArray: Key[]
		//		Array to search.
		// key: Key
		//		Key to locate in the array.
		// fromIndex: Number?
		//		The location in keyArray to start the search from. fromIndex can be
		//		an integer between 0 and the length of keyArray. The default is 0.
		// returns: Number
		//		If found the zero based location of key otherwise -1.
		// tag:
		//		Public
		
		if (key != undef && keyArray instanceof Array) {
			var idx = Number(fromIndex) || 0;
			var max = keyArray.length;
			for(; idx < max; idx++) {
				if (!exports.cmp(key, keyArray[idx])) {
					return idx;
				}
			}
		}
		return -1;
	};
	
	exports.inRange = function (key, keyRange) {
		// summary:
		//		Validate if key is within a key range. A key is considered to be in
		//		range if both the following conditions are fulfilled:
		//
		//		• The key range lower value is undefined or less than key. It may also
		//			be equal to key if lowerOpen is false.
		//		• The key range upper value is undefined or greater than key. It may
		//			also be equal to key if upperOpen is false.
		//
		// key: Key
		//		Key to be evaluated.
		// keyRange: KeyRange?
		//		A KeyRange.
		// returns: Boolean
		//		true if key is in range otherwise false.
		// tag:
		//		Public

		if (exports.validKey(key)) {
			if (!keyRange || (keyRange.lower == undef && keyRange.upper == undef)) {
				return true;
			}
			var lower = keyRange.lower != undef ? exports.cmp(keyRange.lower, key) : -1;
			var upper = keyRange.upper != undef ? exports.cmp(keyRange.upper, key) : 1;

			if ( ((keyRange.lower == undef || lower < 0) || (lower == 0 && !keyRange.lowerOpen)) &&
					 ((keyRange.upper == undef || upper > 0) || (upper == 0 && !keyRange.upperOpen)) ) {
				return true;
			}
		}
		return false;
	};

	exports.keyValue = function (keyPath, object) {
		// summary:
		//		Extract the key value from an object using a key path.
		// keyPath: String|String[]
		//		A key path is a DOMString that defines how to extract a key from a value.
		//		A valid key path is either the empty string, a JavaScript identifier, or
		//		multiple Javascript identifiers separated by periods. (Note that spaces
		//		are not allowed within a key path.)
		// object: Object
		//		Object to extract the key value from.
		// returns: Any
		//		Any. The value returned may or may not be a valid key. To test key
		//		validity call validKey()
		// tag:
		//		Public
		if (keyPath != undef) {
			if (keyPath instanceof Array) {
				// This will only ever "recurse" one level since key path sequences
				// can't ever be nested
				return keyPath.map( function (path) {
					return getProp(path, object);
				});
			}
			if (keyPath != "") {
				return getProp(keyPath, object);
			}
			return object;
		}
	};

	exports.purgeKey = function (keyValue) {
		// summary:
		//		If keyValue is an array, remove all invalid and duplicate	key values
		//		otherwise simply return keyValue.
		// keyValue: Key[]
		//		Key value or key value array.
		// returns: Key[]
		//		keyValue purged.
		// tag:
		//		Public
		if (keyValue instanceof Array) {
			var max = keyValue.length, i = 0, key;
			while ( i < max ) {
				key = keyValue[i];
				if (!exports.validKey(key) || exports.indexOf(keyValue, key) != i) {
					keyValue.splice(i,1);
					max--;
				} else{
					i++;
				}
			}
		}
		return keyValue;
	};

	exports.search = function search (source, key) {
		// summary:
		//		Search in an ordered list of records all records that share key and
		//		return a location object.
		// source: Store|Index
		//		Either a store or index object.
		// key: Key
		//		Key identifying the record(s).
		// returns: Location
		//		A location object.
		// tag:
		//		Public
		var records = source._records;

		if (key != undef) {
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
		}
		return new Location(source);
	};

	exports.sort = function (data, keyPath, ascending) {
		// summary:
		//		Sort an array of objects by their key.
		// data: Object[]
		//		Array of objects.
		// keyPath: KeyPath
		// ascending: Boolean?
		//		If true, the objects are sorted in ascending order otherwise the objects
		//		are sorted in descending order. The default is true.
		// returns: Object[]
		//		The keys array sorted.
		// tag:
		//		Public
		if (keyPath && data instanceof Array) {
			var kA, kB, kV = exports.keyValue;
			ascending = (ascending != undef ? !!ascending : true);
			data.sort( function (a,b) {
				kA = kV(keyPath, a);
				kB = kV(keyPath, b);
				return ( ascending ? exports.cmp(kA,kB) : exports.cmp(kB,kA) );
			});
		}
		return data;
	};

	exports.sortKeys = function (keys, ascending) {
		// summary:
		//		Sort an array of keys. If keys are arrays a deep array comparison
		//		is performed. In accordance with the W3C IndexedDB specs, the rule:
		//		(Array > String > Date > Number) is applied while sorting keys.
		// keys: Key[]
		//		Array of keys.
		// ascending: Boolean?
		//		If true, the keys are sorted in ascending order otherwise the	keys
		//		are sorted in descending order. The default is true.
		// returns: Key[]
		//		The keys array sorted.
		// tag:
		//		Public
		if (keys instanceof Array) {
			ascending = (ascending != undef ? !!ascending : true);
			keys.sort( function (kA, kB) {
				return ( ascending ? exports.cmp(kA,kB) : exports.cmp(kB,kA) );
			});
		}
		return keys;
	};

	exports.test = function (store, value, key) {
		// summary:
		//		Test a value to determine if a store operation would succeed given
		///		the store's use of in-line or out-of-line keys, the availability of
		//		a key generator and the optional key, if provided.
		// store: Store
		//		Instance of a Store
		// value: Object
		//		JavaScript key:value pairs object.
		// key: Key?
		//		Optional, key
		// returns:
		//		Boolean true if store operation would succeed otherwise false.
		// tag:
		//		Private

		if (store.keyPath != undef) {
			if (key != undef) {
				return false;		// Can't have key path AND optional key provided.
			}
			key = exports.keyValue(store.keyPath, value);
		}		
		if (key != undef) {
			if (!exports.validKey(key)) {
				return false;		// Key is not a valid key
			}
		} else {
			if (!store.autoIncrement) {
				return false;		// No key and no key generator
			}
		}
		return true;
	},
	
	exports.toUpperCase = function (key) {
		// summary:
		//		Convert a key value to uppercase.
		// key: Key
		// returns: Key
		//		New key.
		// tag:
		//		Public
		var keyValue = clone(key);
		if (keyValue) {
			if (keyValue instanceof Array) {
				return keyValue.map( exports.toUpperCase );
			}
			if (keyValue.toUpperCase) {
				keyValue = keyValue.toUpperCase();
			}
		}
		return keyValue;
	};

	exports.validKey = function (key) {
		// summary:
		//		Validate if key is a valid indexedDB key
		// key: Key
		//		Key to be validated.
		// returns: Boolean
		//		Boolean, true if a valid key otherwise false.
		// tag
		//		Public
		if (key != undef) {
			if (key instanceof Array) {
				return key.every( exports.validKey );
			}
			return (isString(key) || (typeof key === "number" && !isNaN(key)) ||
							 (key instanceof Date && !isNaN(key.getTime())));
		}
		return false;
	};
	
	exports.validPath = function (keyPath) {
		// summary:
		//		Validate if key path is valid. Note: A key path can be an array
		//		but not nested.
		// keyPath: KeyPath
		//		KeyPath to be validated.
		// returns: Boolean
		//		Boolean, true if a valid path otherwise false.
		// tag
		//		Public
		
		function splitPath (keyPath) {
			if (isString(keyPath)) {
				if (keyPath != "") {
					var properties = keyPath.split(".");
					return properties.every( function (prop) {
						return (/^[_$A-Za-z]/.test(prop) && !/\s/.test(prop));
					});
				}
				return true;
			}
			return false;
		}
		
		if (keyPath != undef) {
			if (keyPath instanceof Array) {
				return keyPath.every( splitPath );
			}
			return splitPath(keyPath);
		}
		return false;
	};

	return exports;
});