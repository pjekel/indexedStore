//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/declare"], function (declare) {
	"use strict";
	// module:
	//		indexedStore/_base/_Procedures
	// summary:
	//		Declare the IDBDatabase procedures. Each store must implement these
	//		procedures. 
	//		(See the indexedStore/_base/_Indexed and indexedStore/_base/_Natural
	//		models for additional details).
	// interface:
	//		_Procedures interface {
	//			sequence<Record>	_clearRecords();
	//			boolean				_deleteKeyRange(Key key);
	//			Location			_retrieveRecord(Key key);
	//			Key					_storeRecord(any value, optional Directives options);
	//		};

	function abstractOnly(method) {
		throw new Error(method + " is abstract only");
	}

	var _Procedures = declare(null, {

		_clearRecords: function () {
			// summary:
			//		Remove all records from the store and all associated indexes.
			// returns: Records[]
			//		An array of all deleted records
			// tag:
			//		protected
			abstractOnly("_clearRecords");
		},

		_deleteKeyRange: function (key) {
			// summary:
			//		Remove all records from store whose key is in the key range.
			// key: Key|KeyRange
			//		Key identifying the record to be deleted. The key arguments can
			//		also be an KeyRange.
			// returns: Boolean
			//		true on successful completion otherwise false.
			// tag:
			//		protected

			abstractOnly("_deleteKeyRange");
		},

		_retrieveRecord: function (key) {
			// summary:
			//		Retrieve the first record from the store whose key matches
			//		key and return a Location object if found.
			// key: Key|KeyRange
			//		Key identifying the record to be retrieved. The key arguments
			//		can also be an KeyRange in which case the first record in range
			//		is returned.
			// returns: Location
			//		A location object. See indexedStore/_base/Location for details.
			// tag:
			//		protected

			abstractOnly("_retrieveRecord");
		},

		_storeRecord: function (value, options, flags) {
			// summary:
			//		Add a record to the store. Throws a StoreError of type ConstraintError
			//		if the key already exists and directive overwrite is set to false.
			// value: Any
			//		Record value property
			// options: PutDirectives?
			//		Optional, PutDirectives
			// flags: Object?
			//		An arbitrary JavaScript key:value pairs object.  The properties
			//		depend on the type of store and extensions used and may include
			//		things like revision, staleness, etc...			
			// returns: Key
			//		Record key.
			// tag:
			//		protected

			abstractOnly("_storeRecord");
		}
	});

	return _Procedures;
});	/* end define() */
