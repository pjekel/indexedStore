//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../_base/Library",
				"../error/createError!store/error/StoreErrors.json",
			 ], function(Lib, createError) {
		"use strict";
	// module:
	//		indexedStore/util/Sorter
	// summary:

	var StoreError = createError("Sorter");
	var getProp    = Lib.getProp;
	
	function Sorter (data, options) {
		//summary:
		// data: Object[]
		// options: Store.QueryOptions?
		// tag:
		//		Public
		"use strict";

		var objects = data || [];  // Make sure we always return something
		var sortSet = options && options.sort;
		var sortFnc = sortSet;
		var total   = objects.length;

		// Can the objects be sorted or do we have a user specified sort function?
		if (typeof objects.sort != "function" && typeof sortFnc != "function") {
			if (typeof objects.slice == "function") {
				objects = objects.slice();
			}
			throw new StoreError("DataError", "Sorter", "object has no sort or slice method");
		}

		if (sortSet) {
			if (typeof sortFnc != "function") {
				sortFnc = function (a, b) {
					var i, sort, prop, valA, valB;

					for(i=0; sort = sortSet[i]; i++) {
						prop = sort.property || sort.attribute;
						valA = getProp.call(Lib, prop,a);
						valB = getProp.call(Lib, prop,b);

						if (sort.ignoreCase) {
							valA = (valA && valA.toLowerCase) ? valA.toLowerCase() : valA;
							valB = (valB && valB.toLowerCase) ? valB.toLowerCase() : valB;
						}
						if (valA != valB) {
							return (!!sort.descending == (valA == null || valA > valB)) ? -1 : 1;
						}
					}
					return 0;
				}
			}
			objects.sort( sortFnc );
		}
		// Paginate the result
		if (options && (options.start || options.count)) {
			objects = objects.slice(options.start || 0, (options.start || 0) + (options.count || Infinity));
		}
		objects.total = total;
		return objects;
	}

	return Sorter;
});
