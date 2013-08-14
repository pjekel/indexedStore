//
// Copyright (c) 2012-2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../_base/Record",
		"../_base/library",
		"../error/createError!../error/StoreErrors.json",
		"./sorter"
	], function (Record, lib, createError, sorter) {
	"use strict";
	// module:
	//		store/util/QueryEngine

	var StoreError = createError("QueryEngine");		// Create the StoreError type.
	var getProp    = lib.getProp;

	function anyOf(valueA, valueB, ignoreCase) {
		// summary:
		//		Test if valueA matches any of valueB values.
		// valueA: any
		//		Value to match against all entries in valueB.
		// valueB: any[]
		//		Array of allowed values
		// ignoreCase: Boolean?
		//		If true perform case insensitive value matching.
		return valueB.some(function (value) {
			return match(valueA, value, ignoreCase);
		});
	}

	function contains(valueA, valueB, ignoreCase) {
		// summary:
		//		Test if an array contains specific value(s) or if array valueA valueB
		//		regular expression(s).
		// valueA: any
		//		Array of valueA to search.
		// valueB: any
		//		A value or regular expression or an array of the previous types to valueB.
		//		If valueB is an array, all elements in the array must valueB.
		// ignoreCase: Boolean?
		//		If set to true and the array valueA have a toLowerCase method a case
		//		insensitive valueB is performed.
		// returns: Boolean
		//		Boolean true or false
		// tag:
		//		Private
		if (valueB) {
			if (valueB.test) {
				return valueA.some(function (value) {
					return valueB.test(value);
				});
			}
			if (valueB instanceof Array) {
				return valueB.every(function (value) {
					value = (ignoreCase && value.toLowerCase) ? value.toLowerCase() : value;
					return contains(valueA, value, ignoreCase);
				});
			}
			if (ignoreCase) {
				return valueA.some(function (value) {
					value  = (ignoreCase && value.toLowerCase) ? value.toLowerCase() : value;
					return (value == valueB);
				});
			}
			return (valueA.indexOf(valueB) != -1);
		}
		return false;
	}

	function hasPropertyPath(query) {
		// summary:
		//		Returns true is the query object includes dot-separated property name(s)
		//		otherwise false.
		// query: Object
		//		JavaScript key:value pairs object.
		var key;
		for (key in query) {
			if (/\./.test(key)) {
				return true;
			}
		}
		return false;
	}

	function match(valueA, valueB, ignoreCase) {
		// summary:
		//		Test if two values match or, if valueA is an array, if valueA contains
		//		valueB.
		// valueA: any
		//		Value or an array of values.
		// valueB: any
		//		A value or regular expression or an array for the previous types.
		// ignoreCase: Boolean?
		//		If true perform case insensitive value matching.
		// returns:
		//		True if there is a match or valueA contains valueB otherwise false.
		// tag:
		//		Private

		if (ignoreCase && valueB && !valueB.test) {
			valueB = valueB.toLowerCase ? valueB.toLowerCase() : valueB;
			valueA = valueA.toLowerCase ? valueA.toLowerCase() : valueA;
		}
		// First, start with a simple base type comparison
		if (valueB == valueA) {
			return true;
		}
		// Second, test for array instance. This must happen BEFORE executing any
		// regular expression because if 'valueB' is a regular expression we must
		// execute the expression on the array elements and not the array itself.
		if (valueA instanceof Array) {
			return contains(valueA, valueB, ignoreCase);
		}
		// Third, check if the object has a test method, which makes it also work
		// with regular expressions (RegExp).
		if (valueB && valueB.test) {
			return valueB.test(valueA);
		}
		// Fourth, check if multiple values are allowed (e.g OR).
		if (valueB instanceof Array) {
			return anyOf(valueA, valueB, ignoreCase);
		}
		return false;
	}

	function QueryEngine(query, options) {
		// summary:
		//		Query engine that matches using filter functions, named filter functions
		//		or a key:value pairs objects (hash).
		// query: (Object|Function)?
		//		- If query is a key:value pairs object, each key:value pair is matched
		//		with the corresponding key:value pair of the store objects unless the
		//		query property value is a function in which case the function is called
		//		as: func(object,key,value).	Query property values can be a string, a
		//		number, a regular expression, an object providing a test() method or an
		//		array of any of the previous types or a function.
		//		- If query is a function, the function is called once for every store
		//		object as query(object). The query function must return boolean true
		//		or false.
		// options: Store.QueryOptions?
		//		Optional dojo/store/api/Store.QueryOptions object that contains optional
		//		information such as sort, start or count.	In addition to the standard
		//		QueryOptions properties, this query engine also support the ignoreCase
		//		property.
		// returns:
		//		A function with the property 'matches'. The 'matches' property equates
		//		to the actual query function.
		//
		// example:
		//		Define a store with a reference to this engine, and set up a query method.
		//
		//	| require([ ... ,
		//	|			"./util/QueryEngine",
		//	|				 ...
		//	|		  ], function(... , QueryEngine, ...) {
		//	|	 var myStore = function(options) {
		//	|		//	...more properties here
		//	|		this.queryEngine = QueryEngine;
		//	|		//	define our query method
		//	|		this.query = function(query, options) {
		//	|			return QueryResults(this.queryEngine(query, options)(this.data));
		//	|		};
		//	|	 };
		//	|	 return myStore;
		//	| });

		var ignoreCase = options && !!options.ignoreCase;
		var hasDotPath = false;
		var queryFunc  = null;

		// Create matching query function. If no query is specified only pagination
		// options will be applied to a dataset.

		switch (typeof query) {
			case "undefined":
			case "object":
				// Test query object for dot-separated property names.
				hasDotPath = hasPropertyPath(query);
				queryFunc  = function (object) {
					var key, value, required;
					for (key in query) {
						required = query[key];
						value    = hasDotPath ? getProp(key, object) : object[key];
						if (!match(value, required, ignoreCase)) {
							if (typeof required == "function") {
								if (required(value, key, object)) {
									continue;
								}
							}
							return false;
						}
					}
					return true;
				};
				break;
			case "function":
				queryFunc = query;
				break;
			default:
				throw new StoreError("InvalidType", "QueryEngine", "Can not query with a " + typeof query);
		} /*end switch() */

		function uniqueness(data, options) {
			// summary:
			// data: Object[]
			// options: Object
			// tag:
			//		Private
			if (data) {
				var unique = options.unique;
				if (typeof unique == "string") {
					unique = unique.split(/\s*,\s/);
				}
				if (unique instanceof Array) {
					var key, keys = {};
					var results = data.filter(function (object) {
						key = unique.map(function (prop) {
							return getProp(prop, object);
						});
						return keys[key] ? false  : keys[key] = true;
					});
					return results;
				}
			}
			return data;
		}

		function execute(data) {
			// summary:
			//		Execute the query on a set of objects and apply pagination to the
			//		query result. This function is returned as the result of a call to
			//		function QueryEngine(). The QueryEngine method provides the closure
			//		for this execute() function.
			// data: (Object|Record)[]
			//		An array of objects or Records on which the query is performed.
			// returns: Object[]
			//		A new array of objects matching the query.
			// tag:
			//		Private
			var paginate, unique, total, results = [];

			paginate = options && (options.start || options.count || options.sort);
			unique   = options && options.unique;
			data     = data || [];

			data.forEach(function (any) {
				var object = any instanceof Record ? any.value : any;
				if (queryFunc(object)) {
					results.push(object);
				}
			});

			if (!!unique) {
				results = uniqueness(results, options);
			}
			total = results.length;
			if (!!paginate) {
				results = sorter(results, options);
			}
			results.total = total;
			return results;
		} /* end execute() */

		execute.matches = queryFunc;
		return execute;
	}	/* end QueryEngine */

	return QueryEngine;
});
