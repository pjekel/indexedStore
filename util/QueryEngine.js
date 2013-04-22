//
// Copyright (c) 2012-2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../_base/Record",
				"../_base/Library",
				"../error/createError!../error/StoreErrors.json",
				"./Sorter",
				"./shim/Array"
			 ], function(Record, Lib, createError, Sorter) {
		"use strict";
	// module:
	//		store/util/QueryEngine

	var StoreError  = createError("QueryEngine");		// Create the StoreError type.
	var getObjClass = Lib.getObjectClass;
	
	function anyOf(/*any*/ valueA, /*any[]*/ valueB, /*Boolean*/ ignoreCase ) {
		// summary:
		//		Test if valueA matches any of valueB values.
		// valueA:
		//		Value to match agains all entries in valueB.
		// valueB:
		//		Array of allowed values
		// ignoreCase:
		//		If true perform case insensitive value matching.
		return valueB.some( function (value) {
			return match( valueA, value, ignoreCase );
		});
	}

	function contains(/*any[]*/ valueA, /*any|any[]*/ valueB, /*Boolean?*/ ignoreCase) {
		// summary:
		//		Test if an array contains specific value(s) or if array valueA valueB
		//		regular expression(s).
		// valueA:
		//		Array of valueA to search.
		// valueB:
		//		A value or regular expression or an array of the previous types to valueB.
		//		If valueB is an array, all elements in the array must valueB.
		// ignoreCase:
		//		If set to true and the array valueA have a toLowerCase method a case
		//		insensitive valueB is performed.
		// returns:
		//		Boolean true or false
		// tag:
		//		Private
		if (valueB) {
			if (valueB.test) {
				return valueA.some( function (value) {
					return valueB.test(value);
				});
			}
			if (valueB instanceof Array) {
				return valueB.every( function (value) {
					value = (ignoreCase && value.toLowerCase) ? value.toLowerCase() : value;
					return contains(valueA, value, ignoreCase);
				});
			}
			if (ignoreCase) {
				return valueA.some( function (value) {
					value  = (ignoreCase && value.toLowerCase) ? value.toLowerCase() : value;
					return (value == valueB);
				});
			}
			return (valueA.indexOf(valueB) != -1);
		}
		return false;
	}

	function getProp (/*String*/ path,/*Object*/ object ) {
		// summary:
		//		Return property value identified by a dot-separated property path
		// path:
		//		Dot separated property path like: feature.attribute.type
		// object:
		//		JavaScript object
		var segm = path.split(".");
		var p, i = 0;

		while(object && (p = segm[i++])) {
			object = object[p];
		}
		return object;
	}

	function hasPropertyPath( query ) {
		// summary:
		//		Returns true is the query object includes dot-separated property name(s)
		//		otherwise false.
		// query:
		//		JavaScript key:value pairs object.
		for(var key in query) {
			if (/\./.test(key)) {
				return true;
			}
		}
		return false;
	}

	function match(/*any*/ valueA, /*any*/ valueB, /*Boolean?*/ ignoreCase ) {
		// summary:
		//		Test if two values match or, if valueA is an array, if valueA contains
		//		valueB.
		// valueA:
		//		Value or an array of values.
		// valueB:
		//		A value or regular expression or an array for the previous types.
		// ignoreCase:
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
		// Thrid, check if the object has a test method, which makes it also work
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

	var QueryEngine = function (/*Object|Function|String*/ query, /*Store.QueryOptions?*/options) {
		// summary:
		//		Query engine that matches using filter functions, named filter functions
		//		or a key:value pairs objects (hash).
		// query:
		//		- If query is a key:value pairs object, each	key:value pair is matched
		//		with	the corresponding key:value pair of	the store objects unless the
		//		query property value is a function in which case the function is called
		//		as: func(object,key,value).		Query property values can be a string, a
		//		number, a regular expression, an object providing a test() method or an
		//		array of any of the previous types or a function.
		//		- If query is a function, the fuction is called once for every store
		//		object as query(object). The query function must return boolean true
		//		or false.
		//		- If query is a string, the string value is the name of a store method.
		// options:
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
		//	|					"./util/QueryEngine",
		//	|					 ...
		//	|				 ], function( ... , QueryEngine, ... ) {
		//	|	 var myStore = function(options) {
		//	|		 //	...more properties here
		//	|		 this.queryEngine = QueryEngine;
		//	|		 //	define our query method
		//	|		 this.query = function(query, options) {
		//	|				return QueryResults(this.queryEngine(query, options)(this.data));
		//	|		 };
		//	|	 };
		//	|	 return myStore;
		//	| });

		var ignoreCase = options && !!options.ignoreCase;
		var hasDotPath = false;
		var queryFunc  = null;
		
		// Create matching query function. If no query is specified only pagination
		// options will be applied to a dataset.

		switch ( typeof query) {
			case "undefined":
			case "object":
				// Test query object for dot-separated property names.
				hasDotPath = hasPropertyPath(query);
				queryFunc  = function (object) {
					var key, value, required;
					for(key in query) {
						required = query[key];
						value		 = hasDotPath ? getProp(key,object) : object[key];
						if (!match( value, required, ignoreCase )) {
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
			case "string":
				// named query
				if (!this[query] || typeof this[query] != "function") {
					throw new StoreError( "MethodMissing", "QueryEngine", "No filter function " + query + " was found in store");
				}
				queryFunc = this[query];
				break;
			case "function":
				queryFunc = query;
				break;
			default:
				throw new StoreError("InvalidType", "QueryEngine", "Can not query with a " + typeof query);
		} /*end switch() */
		
		function uniqueness(/*Object[]*/ data,/*Object*/ options) {
			// summary:
			// data:
			// options:
			// tag:
			//		Private
			if (data) {
				var unique = options.unique;
				if (typeof unique == "string") {
					unique = unique.split(/\s*,\s/);
				}
				if (unique instanceof Array) {
					var key, keys = {};
					var results = data.filter( function (object) {
						key = unique.map( function (prop) {
							return getProp(prop, object);
						});
						return keys[key] ? false  : keys[key] = true;
					});
					return results;
				}
			}
			return data;
		}

		function execute(/*(Object|Record)[]*/ data, /*Boolean?*/ queryKeys) {
			// summary:
			//		Execute the query on a set of objects and apply pagination to the
			//		query result. This function is returned as the result of a call to
			//		function QueryEngine(). The QueryEngine method provides the closure
			//		for this execute() function.
			// data:
			//		An array of objects or Records on which the query is performed.
			// returns:
			//		An array of objects matching the query.
			// tag:
			//		Private
			"use strict";
			var paginate  = options && (options.start || options.count || options.sort);
			var unique    = options && options.unique;
			var queryKeys = queryKeys || false;
			var data      = data || [];
			var results   = [];
			
			data.forEach( function (any) {
				// TODO: how about cloning....
				var object = any instanceof Record ? any.value : any;
				if (queryFunc(object)) {
					results.push(object);
				}
			});

			if (!!unique) {
				results = uniqueness(results, options);
			}
			results.total = results.length;
			if (!!paginate) {
				results = Sorter( results, options );
			}
			return results;
		} /* end execute() */

		execute.matches = queryFunc;
		return execute;

	};	/* end QueryEngine */

	return QueryEngine;
});
