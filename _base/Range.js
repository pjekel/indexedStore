define(["./Keys",
				"./KeyRange",
				"./Library",
				"../error/createError!../error/StoreErrors.json",
			 ], function (Keys, KeyRange, Lib, createError) {

	var StoreError = createError( "Range" );		// Create the StoreError type.
	var isObject = Lib.isObject;
	var clone    = Lib.clone;
	var undef;
	
	function isDirection( direction ) {
		switch (direction) {
			case "next": case "nextunique":
			case "prev": case "prevunique":
				return true;
		}
		return false;
	}
	
	function Range(/*Store|Index*/ source,/*Key|KeyRange*/ keyRange,/*String*/ direction,
									/*Boolean*/ duplicates, /*Boolean*/ keysOnly) {
		// summary:
		//		Retrieve the objects or key in range of a given key range.
		// source:
		//		Instance of Store or Index.
		// keyRange:
		// direction:
		//		The range required direction. Valid options are: 'next', 'nextunique',
		//		'prev' or 'prevunique'. (default is 'next').
		// duplicates:
		//		Detrmines if duplicate keys are allowed in the range. If false, all
		//		duplicate key entries are removed from the range. (default is true).
		// keysOnly:
		//		If true, the record (object) keys are returned otherwise the objects
		//		(record values) are returned. (default is false).
		// returns:
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
			var results    = [];
			
			if (!(keyRange instanceof KeyRange)) {
				if (keyRange != undef) {
					if (!Keys.validKey(keyRange)) {
						throw new StoreError( "TypeError", "constructor" );
					}
					keyRange = KeyRange.only( source.uppercase ? Keys.toUpperCase(keyRange) : keyRange );
				} else {
					keyRange = KeyRange.unbound();
				}
			}			
			if (!isDirection( direction )) {
				throw new StoreError( "TypeError", "constructor", "invalid direction");
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
				if (!ascending) { results.reverse();}
				switch (source.type) {
					case "store":
						records.forEach( function (record) {
							value = keysOnly ? record.key : record.value;
							results.push(source._clone ? clone(value) : value);
						}, this);
						break;
					case "index":
						records.forEach( function (record) {
							var value = ascending ? record.value : clone(record.value).reverse();
							keys = keys.concat( unique ? value[0] : value );
						});
						if (!duplicates) {
							// Remove all duplicate keys
							keys = Keys.purgeKey(keys);
						}
						var store = source.store;
						keys.forEach( function (key) {
							value = keysOnly ? key : store.get(key);
							results.push(store._clone ? clone(value) : value);
						}, this);
						break;
				};	/* end switch() */
			}
			results.keyRange = keysOnly;
			return results;
		} else {
			throw new StoreError("DataError", "Range");
		}
	}	/* end Range() */

	return Range;

});	/* end define() */
