//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/declare",
				"dojo/when",
				"../_base/Observer",
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, when, Observer, createError) {
	
	// module:
	//		store/extension/Observable
	// summary:
	//		This store extension adds support for notification of data changes to
	//		query result sets. The query result sets returned from the store will
	//		include a observe function that can be used to monitor query changes.
	// NOTE:
	//		This module is an extension as opposed to dojo/store/Observable which
	//		is a store wrapper.
	// example:
	//	|	define(["dojo/_base/declare",
	//	|         "store/_base/_Store",
	//	|	        "store/_base/_Indexed",
	//	|	        "store/extension/Observable"
	//	|	       ], function  (declare, _Store, _Indexed, Observable) {
	//	|	  var MyStore = declare([_Store, _Indexed, Observable]);
	//	|	  var store = new MyStore({data: someData});
	//	|	               ..
	//	|	  function listener(object, removedFrom, insertedInto) {
	//	|	    if (removedFrom == insertedInto) {
	//	|	      console.log( "Object with key "+objKey+" was updated");
	//	|	      return;
	//	|	    }
	//	|	    if (removedFrom > -1) {
	//	|	      console.log( "Object with key "+objKey+" was removed from location: "+removedFrom");
	//	|	    }
	//	|	    if (insertedInto > -1) {
	//	|	      console.log( "Object with key "+objKey+" was inserted at location: "+removedFrom");
	//	|	    }
	//	|	  }
	//	|	               ..
	//	|	  var results = store.query({name:/^A/i});
	//	|	  var handle = results.observe( listener, true );
	//	|	});
	
	var StoreError = createError( "Observable" );		// Create the StoreError type.
	
	var Observable = declare(null, {

		//=========================================================================
		// constructor
		
		constructor: function (kwArgs) {
			// Either the base class store/_base/_Natural or store/_base/_Indexed is
			// required.
			if (this.features.has("indexed, natural")) {
				this.features.add("observable");
				this.observable = true;
			} else {
				var message = "base class '_Natural' or '_Indexed' must be loaded first";
				throw new StoreError("Dependency", "constructor", message);
			}
		},
		
		//=========================================================================
		// Public IndexedStore/api/store API methods

		getRange: function (keyRange, direction) {
			// summary:
			//		Retrieve a range of store records.
			// keyRange: Key|KeyRange?
			//		A KeyRange object or valid key.
			// direction: String?
			//		The range required direction. Valid options are: 'next', 'nextunique',
			//		'prev' or 'prevunique'.
			// returns: dojo/store/api/Store.QueryResults
			//		The results of the query, extended with iterative methods.
			// tag:
			//		Public

			function observe (listener, includeUpdates, scope) {
				// summary:
				//		The observe method added to the query results, that is, if the
				//		query results has a forEach method. When called the listener is
				//		registered with the Observer and will be notified of changes to
				//		results set.
				// listener: Listener|Function
				//		The listener called when the query results changed or when an
				//		object being part of the query results has changed.
				// includeUpdates: Boolean?
				//		If true, the listener will also be notified when an object that
				//		is part of the results set has simply changed.
				// scope: Object?
				//		Object to use as 'this' when executing listener.
				// returns: Object
				//		An object with a remove() method. The remove method can be used
				//		to remove the listener from the Observer object.
				// tag:
				//		Public
				
				if (!observer) {
					observer = new Observer(store, results, keyRange, direction, revision);
					observer.done( function () { observer = null;	});
				}
				return observer.addListener(listener, includeUpdates, scope);
			}

			var results   = this.inherited(arguments);		// Call 'parent' getRange()
			var direction = direction || "next";
			var keyRange  = keyRange;
			var store     = this;
			var observer  = null;
			var revision  = 0;
			
			// Test if the results can be iterated.
			if (results && typeof results.forEach == "function") {
				// Don't set the revision until the QueryResults resolves.
				results.revision = when( results, function () {
					revision = revision || store.revision;
					return revision;
				});
				results.observe = observe;
			}
			return results;
		},

		query: function (query, options) {
			// summary:
			//		Queries the store for objects. The query result gets an additional
			//		method called observe which, when called, starts monitoring the
			//		query result for any changes.
			// query: Object?
			//		The query to use for retrieving objects from the store.
			// options: Store.QueryOptions?
			//		The optional arguments to apply to the resultset.
			// returns: dojo/store/api/Store.QueryResults
			//		The results of the query, extended with iterative methods.
			// tag:
			//		Public

			function observe (listener, includeUpdates, scope) {
				// summary:
				//		See getRange.observer()
				if (!observer) {
					observer = new Observer(store, results, query, options, revision);
					observer.done( function () { observer = null;	});
				}
				return observer.addListener(listener, includeUpdates, scope);
			}

			var results  = this.inherited(arguments);	// Call 'parent' query()
			var options  = options || {};
			var store    = this;
			var observer = null;
			var revision = 0;
			
			// Test if the results can be iterated.
			if (results && typeof results.forEach == "function") {
				results.revision = when( results, function () {
					revision = revision || store.revision;
					return revision;
				});
				results.observe = observe;
			}
			return results;
		}

	});	/* end declare() */
	
	return Observable;

});	/* end define() */
