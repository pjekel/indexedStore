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
				"../_base/Keys",
				"../_base/KeyRange",
				"../_base/Library",
				"../_base/Observer",
				"../error/createError!../error/StoreErrors.json",
				"../listener/Listener"
			 ], function (declare, when, Keys, KeyRange, Lib, Observer, createError, Listener) {
	
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
	//	|	        "store/_base/_Loader",
	//	|	        "store/extension/Observable"
	//	|	       ], function  (declare, _Store, _Indexed, _Loader, Observable) {
	//	|	  var MyStore = declare([_Store, _Indexed, _Loader, Observable]);
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
	var isObject   = Lib.isObject;
	var undef;
	
	var Observable = {

		//=========================================================================
		// constructor
		
		constructor: function (kwArgs) {
			// Either the base class store/_base/_Natural or store/_base/_Indexed is
			// required.
			if (this.features.has("indexed, natural")) {

				this.features.add("observable");
				this.observable = true;
				
				Lib.protect( this );		// Hide own private proeprties.
			} else {
				throw new StoreError( "Dependency", "constructor", "base class '_Natural' or '_Indexed' must be loaded first");
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

			function observe (callback, includeUpdates, thisArg) {
				// summary:
				//		The observe method added to the query results, that is, if the
				//		query results has a forEach method. When called the callback is
				//		registered with the Observer and will be notified of changes to
				//		results set.
				// callback: Function
				//		The callback called when the query results changed or when an
				//		object being part of the query results has changed.
				// includeUpdates: Boolean?
				//		If true, the callback will also be notified when an object that
				//		is part of the results set has simply changed.
				// thisArg: Object?
				//		Object to use as this when executing callback.
				// returns: Object
				//		An object with a remove() method. The remove method can be used
				//		to remove the listener from the Observer object.
				// tag:
				//		Public
				
				if (!observer) {
					observer = new Observer(store, results, keyRange, direction);
					observer.done( function () { observer = null;	});
				}
				var listOpts = {updates: !!includeUpdates};
				var listener = new Listener(callback, listOpts, thisArg);
				observer.addListener(listener);

				return {
					remove: function () { 
						observer.removeListener(listener ); 
					}
				};
			}	/* end observe() */

			var results   = this.inherited(arguments);		// Call parent getRange()
			var direction = direction || "next";
			var keyRange  = keyRange;
			var store     = this;
			var observer  = null;
			var handle    = null;
			
			// Test if the results can be iterated.
			if (results && typeof results.forEach == "function") {
				results.revision = when( results, function () {
					return (results.revision = store.revision);
				});
				results.observe = observe;
			}
			return results;
		},

		query: function (query, options) {
			// summary:
			//		Queries the store for objects. The query result get an additional
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

			function observe (callback, includeUpdates, thisArg) {
				// summary:
				//		See getRange.observer()
				if (!observer) {
					observer = new Observer(store, results, query, options );
					observer.done( function () { observer = null;	});
				}
				var listOpts = {updates: !!includeUpdates};
				var listener = new Listener(callback, listOpts, thisArg);
				observer.addListener(listener);

				return {
					remove: function () { 
						observer.removeListener(listener); 
					}
				};
			}	/* end observe() */

			var results  = this.inherited(arguments);	// Call parent query()
			var options  = options || {};
			var store    = this;
			var observer = null;
			var handle   = null;
			
			// Test if the results can be iterated.
			if (results && typeof results.forEach == "function") {
				results.revision = when( results, function () {
					return (results.revision = store.revision);
				});
				results.observe = observe;
			}
			return results;
		}

	};	/* end Observable {} */
	
	return declare( null, Observable);

});	/* end define() */
