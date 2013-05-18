//
// Copyright (c) 2012, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define(["dojo/_base/declare",
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, createError) {
	"use strict";

	var StoreError = createError("Index");		// Create the StoreError type.

	var Index = declare( null, {

		//=========================================================================
		// Index Properties

		// keyPath: String|String[]
		//		A key path is a DOMString that defines how to extract a key from an
		//		object. A valid key path is either the empty string, a JavaScript
		//		identifier, or multiple Javascript identifiers separated by periods (.)
		//		(Note that spaces are not allowed within a key path.)
		//		In addition, the keyPath property can also be an array of key paths.
		keyPath: null,

		// multiEntry: Boolean,
		//		The multiEntry property affects how the index behaves when the record
		//		key is an Array.   If multiEntry is false, then a single record whose 
		//		key is an Array is added to the index. If multiEntry is true, then the
		//		one record is added to the index for each item in the Array.  The key
		//		for each record is the value of respective item in the Array. 
		multiEntry: false,
		
		// name: String
		//		The index name (required)
		name: "",
		
		// unique: Boolean
		//		The unique property enforces that no two records in the index has the
		//		same key. If a record in the index's referenced store is attempted to
		//		be inserted or modified such that evaluating the index's key path on
		//		the records new value yields a result which already exists in the index,
		//		then the attempted modification to the object store fails. 
		unique: false,
		
		// store: Store
		store: null,

		//=========================================================================
		// Index Methods

		count: function (/*Key|KeyRange?*/ key) {
			// summary:
			//		Count the total number of records that share the key or key range.
			//		If the optional key parameter is not a valid key or a key range,
			//		this method throws a StoreError of type DataError.
			// key:
			//		Key identifying the record to be retrieved. The key arguments can
			//		also be an KeyRange.
			// returns:
			//		The total number of records.
			// tag:
			//		Public
		},

		get: function (/*Key|KeyRange*/ key) {
			// summary:
			//		Retrieves an object by its key
			// key:
			//		Key identifying the record to be retrieved. This can also be an
			//		KeyRange in which case the function retreives the first existing
			//		value in that range.
			// returns:
			//		The object in the store that matches the given key otherwise void.
			// tag:
			//		Public
		},

		getKey: function (/*Key|KeyRange*/ key) {
			// summary:
			//		Get the first record that matches key.   The index record value, that
			//		is, the primary key of the referenced store is returned as the result
			// key:
			//		Key identifying the record to be retrieved. This can also be an
			//		KeyRange in which case the function retreives the first existing
			//		value in that range.
			// returns:
			//		The primary key of the referenced store.
			// tag:
			//		Public
		},

		getRange: function (/*Key|KeyRange*/ keyRange, /*QueryOptions?*/ options) {
			// summary:
			//		Retrieve a range of store records.
			// keyRange:
			//		A KeyRange object or a valid key.
			// options:
			//		The optional arguments to apply to the resultset.
			// returns: dojo/store/api/Store.QueryResults
			//		The results of the query, extended with iterative methods.
			// tag:
			//		Public
		},
		
		openCursor: function (/*any*/ range, /*DOMString*/ direction) {
			// summary:
			//		Open a new cursor. A cursor is a transient mechanism used to iterate
			//		over multiple records in the store.
			// range:
			//		The key range to use as the cursor's range.
			// direction:
			//		The cursor's required direction. Possible directions are: 'next'
			//		'nextunique', 'prev' and 'prevunique'
			// returns:
			//		A cursorWithValue object.
			// example:
			//		| var cursor = store.openCursor();
			//		| while( cursor && cursor.value ) {
			//		|       ...
			//		|     cursor.continue();
			//		| };
			// tag:
			//		Public
		},

		openKeyCursor: function (/*any*/ range, /*DOMString*/ direction) {
			// summary:
			//		Open a new cursor. A cursor is a transient mechanism used to iterate
			//		over multiple records in the store.
			// range:
			//		The key range to use as the cursor's range.
			// direction:
			//		The cursor's required direction. Possible directions are: 'next'
			//		'nextunique', 'prev' and 'prevunique'
			// returns:
			//		A cursorWithValue object.
			// example:
			//		| var cursor = store.openCursor();
			//		| while( cursor && cursor.value ) {
			//		|       ...
			//		|     cursor.continue();
			//		| };
			// tag:
			//		Public
		},

		ready: function (/*Function?*/ callback,/*Function?*/ errback,/*thisArg*/ scope) {
			// summary:
			//		Execute the callback when the store has been loaded. If an error
			//		is detected that will prevent the store from getting ready errback
			//		is called instead.
			// note:
			//		When the promise returned resolves it merely indicates one of
			//		potentially many load requests was successful. To keep track of
			//		a specific load request use the promise returned by the load()
			//		function instead.
			// callback:
			//		Function called when the store is ready.
			// errback:
			//		Function called when a condition was detected preventing the store
			//		from getting ready.
			// scope:
			//		The scope/closure in which callback and errback are executed. If
			//		not specified the store is used.
			// returns:
			//		dojo/promise/Promise
			// tag:
			//		Public
		}

	});

	return Index;

});
