//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License			(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/declare",
		"dojo/Deferred",
		"dojo/json",
		"dojo/when",
		"./_assert",
		"./_Loader!Rest",		// Use the REST loader
		"./Keys",
		"./library",
		"../error/createError!../error/StoreErrors.json",
		"../util/QueryResults",
		"../util/sorter"
	], function (declare, Deferred, JSON, when, assert, _Loader, Keys,
				 lib, createError, QueryResults, sorter) {
	"use strict";
	// module:
	//		indexedStore/_base/_RestAPI
	// summary:
	//
	// example:

	var StoreError = createError("Rest");			// Create the StoreError type.
	var isObject   = lib.isObject;
	var clone      = lib.clone;						// HTML5 structured clone.
	var mixin      = lib.mixin;
	var keyToPath  = lib.keyToPath;

	var C_MSG_DEPENDENCY_STORE = "base class '_Store' must be loaded first";

	var restDirectives = {
		// cache: Boolean
		cache: true
	};

	var Rest = declare([_Loader], {

		//===================================================================
		// Constructor

		constructor: function (kwArgs) {
			if (this.features.has("store")) {
				// Mixin and initialize the REST directives.
				this._directives.declare(restDirectives, directives);
				this.features.add("rest");
			} else {
				throw new StoreError("Dependency", "constructor", C_MSG_DEPENDENCY_STORE);
			}
		},

		//=========================================================================
		// Public IndexedStore/api/store API methods

		add: function (object, options) {
			// summary:
			//		Add an object to the store. If an object with the same key already
			//		exists an exception of type ConstraintError is thrown.
			// object: Object
			//		The new object to store.
			// options: Store.PutDirectives?
			//		Additional metadata for storing the data.	Includes an "id" or "key"
			//		property if a specific key is to be used.
			// returns: Key
			//		A valid key
			// tag:
			//		Public
			var data, handleAs, headers, objKey, optKey, result;
			var self = this;

			assert.store(this, "add", true);

			options  = mixin(options, {overwrite: false});
			optKey   = options.key != null ? options.key : (options.id != null ? options.id : null);
			objKey   = this.getIdentity(object) || optKey;

			handleAs = options.handleAs || this.handleAs || "json";
			data     = JSON.stringify(object);

			headers = mixin(this.headers, options.headers);
			result = this.submit({method: "PUT", resourceId: objKey, headers: headers, formData: data});
			return when(result.response,
				function (response) {
					// The service may return an object or a key.
					var data = response && response.data;
					var storeKey = null;
					if (isObject(data)) {
						storeKey = self.getIdentity(data) || objKey;
					} else if (Keys.validKey(data)) {
						storeKey = data;
					}
					return storeKey;
				});
		},

		get: function (key, options) {
			// summary:
			//		Retrieves an object by its key
			// key: Key|KeyRange
			//		Key identifying the record to be retrieved.
			// returns: Promise
			// tag:
			//		Public
			var defer, headers, objKey, record, results, value;
			var self = this;

			assert.store(this, "get", false);
			assert.key(key, "get", true);

			options = options || {};
			objKey  = keyToPath(key);

			if (this.cache) {
				record = this._retrieveRecord(objKey).record;
				if (record) {
					if (!record.tags.stale) {
						value = this._clone ? clone(record.value) : record.value;
						defer = new Deferred();
						return defer.resolve(value);
					}
				}
			}
			headers = mixin(this.headers, options.headers);
			results = this.load({resourceId: objKey, headers: headers});
			return when(results.response, function (response) {
				if (response && response.data) {
					var value = self._retrieveRecord(objKey).value;
					return value;
				}
			});
		},

		put: function (object, options) {
			// summary:
			//		Stores an object
			// object: Object
			//		The value to be stored in the record.
			// options: Store.PutDirectives?
			//		Additional metadata for storing the data.
			// returns: Key
			//		A valid key.
			// tag:
			//		Public
			var data, exists, handleAs, headers, objKey, method, optKey, result;
			var self = this;

			assert.store(this, "put", true);

			options  = mixin(options, {overwrite: true});
			optKey   = options.key != null ? options.key : (options.id != null ? options.id : null);
			objKey   = this.getIdentity(object) || optKey;

			handleAs = options.handleAs || this.handleAs || "json";
			data     = JSON.stringify(object);

			// Check the cache if the object exists
			exists   = objKey != null ? !!this._retrieveRecord(objKey).record : false;
			method   = exists ? "PUT" : "POST";

			headers = mixin(this.headers, options.headers);
			result = this.submit({method: method, resourceId: objKey, headers: headers, formData: data});
			return when(result.response,
				function (response) {
					// The service may return an object or a key.
					var data = response && response.data;
					var storeKey = null;
					if (isObject(data)) {
						storeKey = self.getIdentity(data) || objKey;
					} else if (Keys.validKey(data)) {
						storeKey = data;
					}
					return storeKey;
				});
		},

		query: function (query, options /*, data */) {
			// summary:
			//		Queries the store for objects. This will trigger a GET request to the server, with the
			//		query added as a query string.
			// query: Object
			//		The query to use for retrieving objects from the store.
			// options: __QueryOptions?
			//		The optional arguments to apply to the resultset.
			// returns: dojo/store/api/Store.QueryResults
			//		The results of the query, extended with iterative methods.
			var headers, results;
			var data  = (arguments.length > 2 ?	arguments[2] : null);

			if (!isObject(query)) {
				throw new StoreError("DataError", "query", "query argument must be an object");
			}
			options = options || {};
			if (this.cache && data) {
				if (data.length && (options.sort || options.start || options.count)) {
					sorter(data, options);
				}
				return QueryResults(this._clone ? clone(data) : data);
			}
			headers = mixin(this.headers, options.headers);
			results = this.load({resourceId: query, headers: headers, loadOnly: true});
			return when(results.response,
				function (response) {
					var data = (response && response.data) || [];
					data = data instanceof Array ? data : [data];
					if (data.length && (options.sort || options.start || options.count)) {
						sorter(data, options);
					}
					return QueryResults(data);
				});
		},

		remove: function (key, options) {
			// summary:
			//		Delete object(s) by their key
			// key: Key|KeyRange
			//		The key or key range identifying the record(s) to be deleted. If
			//		a key range, all records within the range will be deleted.
			// returns: Promise
			//		The promise resolves with true if an object was removed otherwise
			//		false.
			// tag:
			//		Public
			var headers, objKey, result;

			assert.store(this, "remove", true);
			assert.key(key, "remove", true);

			options = options || {};
			objKey  = keyToPath(key);

			headers = mixin(this.headers, options.headers);
			result  = this.submit({method: "DELETE", resourceId: objKey, headers: headers});
			return when(result.response, function (response) {
				if (response && response.data) {
					return true;
				}
			});
		}

	});	/* end declare() */
	return Rest;
});
