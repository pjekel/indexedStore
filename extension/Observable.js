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
				"../_base/Keys",
				"../_base/KeyRange",
				"../_base/Library",
				"../_base/Listener",
				"../_base/Observer",
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, Keys, KeyRange, Lib, Listener, Observer, createError) {
	
	// module:
	//		store/extension/Observable
	// summary:
	//		This store extension adds support for notification of data changes to
	//		query result sets. The query result sets returned from the store will
	//		include a observe function that can be used to monitor query changes.
	// NOTE:
	//		This module is an extension as opposed to the dojo/store/Observable
	//		which is a store wrapper.
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
				throw new StoreError( "MethodMissing", "constructor", "base class '_Natural' or '_Indexed' must be loaded first");
			}
		},
		
		//=========================================================================
		// Public store/api/store API methods

		notify: function (/*Object?*/ object,/*Key?*/ key) {
			// summary:
			//		This method is for dojo/store/Observable API compatibility only.
			//		Because it is unknown why the applications called this method it
			//		is impossible to perform the same level of testing as add() and
			//		put() would do.
			// object:
			//		A valid JavaScript object.
			// key:
			//		A valid key.
			// tag:
			//		Public

			if ((object && isObject(object)) || (!object && Keys.validKey(key))) {
				if (object) {
					var evtType = (key != undef) ? "change" : "new";
				} else {
					var evtType = "delete";
				}			
				this._observers.forEach( function ( observer ) {
					observer.updater(evtType, key, object);
				}, this);
			} else {
				throw new StoreError( "DataError", "notify" );
			}
		},

		getRange: function (/*Key|KeyRange?*/ keyRange,/*String*/ direction) {
			// summary:
			//		Retrieve a range of store records.
			// keyRange:
			//		A KeyRange object or valid key.
			// direction:
			//		The range required direction. Valid options are: 'next', 'nextunique',
			//		'prev' or 'prevunique'.
			// returns: dojo/store/api/Store.QueryResults
			//		The results of the query, extended with iterative methods.
			// tag:
			//		Public

			function observe (/*Function*/ callback,/*Boolean?*/ includeUpdates, /*Object*/ thisArg ) {
				// summary:
				//		The observe method added to the query results, that is, if the
				//		query results has a forEach method. When called the listener is
				//		registered with the query Observer.
				// listener:
				//		The callback called when the query results changed or when an
				//		object being part of the query results has changed.
				// includeUpdates:
				//		If true, the listener will also be called when an object that is
				//		part of the query result has changed.
				// thisArg:
				//		Object to use as this when executing callback.
				// returns:
				//		An object with a remove() method. The remove method can be used
				//		to remove the listener from the Observer object.
				// tag:
				//		Public
				
				if (!observer) {
					observer = new Observer(store, results, keyRange, direction, revision);
					handle   = observer.on("release", function (event) {
						handle.remove();
						observer = null;
					});
				}

				var options  = {updates: !!includeUpdates };
				var listener = new Listener(callback, options, thisArg);
				observer.addListener("range", listener);

				return {
					remove: function () { 
						observer.removeListener("range", listener ); 
					}
				};
			}	/* end observe() */

			var results   = this.inherited(arguments);
			var direction = direction || "next";
			var keyRange  = KeyRange.unbound();
			var store     = this;
			var revision  = store.revision;
			var observer  = null;
			var handle    = null;
			
			// Test if the results can be iterated.
			if (results && typeof results.forEach == "function") {
				results.observe = observe;
			}
			return results;
		},

		query: function (/*Object*/ query,/*Store.QueryOptions*/ options ) {
			// summary:
			//		Queries the store for objects. The query result get an additional
			//		method called observe which, when called, starts monitoring the
			//		query result for any changes.
			// query: Object
			//		The query to use for retrieving objects from the store.
			// options:
			//		The optional arguments to apply to the resultset.
			// returns: dojo/store/api/Store.QueryResults
			//		The results of the query, extended with iterative methods.
			// tag:
			//		Public

			function observe (/*Function*/ listener,/*Boolean?*/ includeUpdates, /*Object*/ thisArg ) {
				// summary:
				//		See getRange.observer()
				if (!observer) {
					observer = new Observer(store, results, query, options, revision );
					handle   = observer.on("release", function (event) {
						handle.remove();
						observer = null;
					});
				}
				var options  = {updates: !!includeUpdates };
				listener = new Listener(listener, options, thisArg);
				observer.addListener("query", listener);

				return {
					remove: function () { 
						observer.removeListener("query", listener ); 
					}
				};
			}	/* end observe() */

			// Call 'parent' query 
			var results  = this.inherited(arguments);
			var options  = options || {};
			var store    = this;
			var revision = store.revision;
			var observer = null;
			var handle   = null;
			
			// Test if the results can be iterated.
			if (results && typeof results.forEach == "function") {
				results.observe = observe;
			}
			return results;
		}

	};	/* end Observable {} */
	
	return declare( null, Observable);

});	/* end define() */
