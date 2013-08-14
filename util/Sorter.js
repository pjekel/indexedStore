//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../_base/library",
		"../error/createError!store/error/StoreErrors.json"
	], function (lib, createError) {
	"use strict";

	// module:
	//		indexedStore/util/sorter
	// summary:
	//		Sort and paginate an array of objects.

	var StoreError = createError("Sorter");
	var getProp    = lib.getProp;

	function sorter(data, options) {
		// summary:
		//		Sort and/or slice an array of data. The data is sorted base on
		//		the directives included in the options. The sorter mutates the
		//		original data array, however, sorting only takes place if, and
		//		only if, sort directives are provided.
		// data: any[]
		//		The array to be sorted.
		// options: Store.QueryOptions?
		//		A JavaScript object including sort and pagination properties.
		// returns: Object[]
		//		The sorted and/or sliced array.
		// tag:
		//		Public
		var sortOpts, sortFunc;

		options = options || {};
		data    = data || [];

		// Can the data be sorted or do we have a user specified sort function?
		if (typeof data.sort != "function" && typeof sortFunc != "function") {
			throw new StoreError("DataError", "Sorter", "object has no sort method");
		}
		if (options.sort) {
			// First, define the sort function if none was specified.
			if (typeof options.sort != "function") {
				sortFunc = function (a, b) {
					var i = 0, sortInfo = sortOpts[i++];
					var prop, valA, valB;

					while (sortInfo) {
						prop = sortInfo.property || sortInfo.attribute;
						valA = getProp(prop, a);
						valB = getProp(prop, b);

						if (sortInfo.ignoreCase) {
							valA = (valA && valA.toLowerCase) ? valA.toLowerCase() : valA;
							valB = (valB && valB.toLowerCase) ? valB.toLowerCase() : valB;
						}
						if (valA != valB) {
							return (!!sortInfo.descending == (valA == null || valA > valB)) ? -1 : 1;
						}
						sortInfo = sortOpts[i++];
					}
					return 0;
				}; /* end sortFunc() */
				sortOpts = options.sort;
			} else {
				sortFunc = options.sort;
			}
			data.sort(sortFunc);
		}
		if (options.start) {
			data.splice(0, options.start);
		}
		if (options.count > 0 && options.count !== Infinity) {
			data.length = options.count;
		}
		return data;
	} /* end sorter() */
	return sorter;
});
