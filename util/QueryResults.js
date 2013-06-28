define(["dojo/when", "../shim/Object"], function (when) {
	"use strict";

		// module
	//		indexedStore/util/queryResults
	// summary:
	//		In case results is a Promise or Deferred, this QueryResults guarantees
	//		that the results property 'total' is actually a number once the results
	//		resolve and not yet another promise.

	function QueryResults(data) {
		// summary:
		//		A function that wraps the results of a store query with additional
		//		methods.
		// description:
		//		QueryResults is a basic wrapper that allows for array-like iteration
		//		over any kind of returned data from a query.  While the simplest store
		//		will return a plain array of data, other stores may return deferreds or
		//		promises; this wrapper makes sure that *all* results can be treated
		//		the same.
		//
		//		Additional methods include `forEach`, `filter` and `map`.
		// data: Array|dojo/promise/Promise
		//		The result set as an array, or a promise for an array.
		// returns:
		//		An array-like object that can be used for iterating over.
		// example:
		//		Query a store and iterate over the results.
		//
		//	|	store.query({ prime: true }).forEach(function(item){
		//	|		//	do something
		//	|	});
		var results = Object.create(data);

		function addIterativeMethod(method) {
			if (!results[method]) {
				results[method] = function () {
					var args = arguments;
					return when(results, function (results) {
						return queryResults(Array.prototype[method].apply(results, args));
					});
				};
			}
		}
		if (!(results instanceof Array)) {
			addIterativeMethod("forEach");
			addIterativeMethod("filter");
			addIterativeMethod("map");
		}
		results.total = when(results, function (qres) {
			results.total = qres.total !== undefined ? qres.total : qres.length;
			return results.total;
		});
		return results; // Object
	};
	return QueryResults;
});