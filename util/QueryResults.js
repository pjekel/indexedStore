define(["dojo/when",
				"../_base/Library"], function (when, Lib) {
	// module
	//		indexedStore/util/QueryResults
	// summary:
	//		In case results is a Promise or Deferred, this QueryResults quarantees
	//		that the results property 'total' is actually a number once the results
	//		resolve and not yet another promise.

	var QueryResults = function (results, source) {
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
		// results: Array|dojo/promise/Promise
		//		The result set as an array, or a promise for an array.
		// source: (Store|Index)?
		// returns:
		//		An array-like object that can be used for iterating over.
		// example:
		//		Query a store and iterate over the results.
		//
		//	|	store.query({ prime: true }).forEach(function(item){
		//	|		//	do something
		//	|	});
		"use strict";
		
		function addIterativeMethod(method){
			if(!results[method]){
				results[method] = function () {
					var args = arguments;
					return when(results, function(results){
						return QueryResults(Array.prototype[method].apply(results, args));
					});
				};
			}
		}
		var store = source && (source.store || source);
		if (Object.isFrozen(results)) {
			results = Object.create(results);
		}

		if (!(results instanceof Array)) {
			addIterativeMethod("forEach");
			addIterativeMethod("filter");
			addIterativeMethod("map");
		}
		results.total = when( results, function (qres) {
			results.total = ("total" in qres) ? qres.total : qres.length;
			return results.total;
		});
/*
		if (store) {
			results.revision = when (results, function () {
				return store.revision;
			});
		}
*/
		return results; // Object
	};
	return QueryResults;
});