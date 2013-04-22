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
				"../_base/Library",
				"../dom/event/Event",
				"../dom/event/EventTarget",
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, when, Keys, Lib, Event, EventTarget, createError) {
	
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
	
	function locate (/*Store*/ store,/*Object[]*/ objAry,/*Key*/ key) {
		// summary:
		// 		Locate an object with a given key in an arry of objects.
		for (var idx = 0; idx < objAry.length; idx++) {
			if (!Keys.cmp( key, store.getIdentity(objAry[idx]) )) {
				return idx;
			}
		}
		return -1;
	}

	function move(/*Object[]*/ objAry,/*Number*/ from,/*Number*/ to,/*Object*/ object) {
		// summary:
		//		Insert, relocate or delete an object in an array of objects.
		if (from != -1) {
			objAry.splice(from,1);
		}
		if (to != -1) {
			to = from > -1 ? (from < to ? --to : to) : to;
			objAry.splice(to, 0, object);	// Insert new or updated object.
		}
	}

	function Listener (/*String*/ type, /*Function*/ callback,/*Object*/ options,/*Object*/ thisArg) {
		// summary:
		//		Create an Observer Listener object.
		// type:
		//		The type of listener being registered
		// callback:
		//		The method to be called whenever an update occurs on the query result
		//		for which the callback was registered.
		// options:
		//		A JavaScript key:value pairs object. The object properties may vary
		//		based on the listener type.
		// thisArg:
		//		Object to use as this when executing callback.
		// tag:
		//		Private
		if (typeof callback != "function") {
			throw new StoreError("TypeError", "Listener", "listener is not a callable object");
		}
		this.options  = options || {};
		this.callback = callback;
		this.scope    = thisArg;
		this.type     = type;
	}

	function Observer (/*Object*/ kwArgs ) {
		// summary:
		//		An Observer is an object capable of monitoring query results and
		//		notify listeners of any changes.  To instantiate an Observer the
		//		user must call the observe() method on the query result set.
		// kwArgs:
		//		A JavaScript key:value pairs object. The object properties are a set
		//		of arguments passed to the Observer instance.
		// tag:
		//		Private
		"use strict";
		
		this.addListener = function (/*Listener*/ listener) {
			// summary:
			//		Register a Listener object by it's type with this Observer. 
			// listener:
			//		A Listener object.
			// tag:
			//		Private
			this.removeListener( listener, true );
			var listenerByType = listeners[listener.type] || [];
			listenerByType.push(listener);
			listeners[listener.type] = listenerByType;
		};

		this.clear = function () {
			// summary:
			// tag:
			//		Private
			listeners.forEach( this.removeListener, this );
		};
		
		this.getListener = function (/*String*/ type ) {
			// summary:
			//		Return an array of listeners of a given type.
			// type:
			//		Listener type.
			// tag:
			//		Private
			return listeners[type] ? listeners[type].slice() : [];
		};

		this.removeListener = function (/*Listener*/ listener,/*Boolean?*/ retain) {
			// summary:
			//		Remove a listener from the Observer.
			// listener:
			//		Listener object to be removed.
			// retain:
			//		If true, the Observer instance will not be removed from the store
			//		when the number of listeners drops to zero. As a result, no event
			//		of type 'release' is fired either.
			// tag:
			//		Private
			if (listener instanceof Listener) {
				var lstByType = listeners[listener.type] || [];
				if (lstByType.length) {
					lstByType.some( function (handler, index) {
						if (handler.callback == listener.callback) {
							lstByType.splice(index, 1);
							return true;
						}
					});
					if (lstByType.length) {
						listeners[listener.type] = lstByType;
					} else {
						delete listeners[listener.type];
					}
				}
				if (listeners.length == 0 && !retain) {
					var index = store._observers.indexOf(this);
					if (index != -1) {
						store._observers.splice(index,1);
						this.dispatchEvent( new Event( "release" ));
					}
				}
			}
		};

		this.updater = function (/*event.type*/ type,/*Key*/ key,/*Object*/ object ) {
			// summary:
			//		Notify all listeners of type 'observe' which are associated with
			//		this Observer instance if the object impacts the query result set.
			// type:
			//		Store event type
			// key:
			//		Key identifying the object.
			// object:
			//		The object that was added, deleted or updated.
			// returns:
			//		The old object if the query result is affected by the store update
			//		otherwise 'undefined'.
			// tag:
			//		Private
			
			return when( results, function (objAry) {
				if (++revision != store._revision) {
					// Store updates were made prior to observing the query results.
					observer.clear();	// Cleanup
					throw new StoreError("InvalidState", "updater", "Query is out of date due to previous store changes");
				}
				var newObj = type == "new";
				var atEnd  = objAry.length != options.count;
				var from   = (!newObj ? locate(store, objAry, key) : -1);
				var oldObj = from > -1 ? objAry[from] : undef;
				var into   = -1;
				
				if (type != "delete") {
					if (queryFunc) {
						if (matches ? matches(object) : queryFunc([object])) {
							if (newObj) {
								objAry.push(object);
							}
							into = locate( store, queryFunc(objAry), key );
						}
					} else {
						into = newObj ? objAry.push(object) - 1 : from;
					}
				}
				if (from != into) {
					if ( (options.start > 0 && into == 0) || (!atEnd && into == objAry.length)) {
						objAry.splice(into, 1);
						into = -1;
					} else {
						move( objAry, from, into, object );	// Insert, delete or relocate object.
					}
				}
				if (from > -1 || into > -1) {
					var listenerByType = observer.getListener("observe");
					listenerByType.forEach( function (listener) {
						if (from != into || listener.options.updates) {
							listener.callback.call( listener.scope, object, from, into);
						}
					});
					// If the object had an impact on the query, return the original object
					// so the caller will have both the new and old available.
					return oldObj;
				}
			});	/* end when() */
		};
		
		// Initialize the Event Target and setup the closure
		EventTarget.call(this);
		
		var observer    = this;
		var listeners   = [];

		var store       = kwArgs.store;
		var query       = kwArgs.query;
		var options     = kwArgs.options;
		var revision    = kwArgs.revision;
		var results     = kwArgs.results;
		var queryEngine = store.queryEngine;
		
		var updOptions  = Lib.clone( options );
		updOptions.start = 0;
		updOptions.count = 0;

		var queryFunc = queryEngine && queryEngine( query, updOptions);
		var matches   = queryFunc && queryFunc.matches;
	}

	Observer.prototype = new EventTarget();
	Observer.prototype.constructor = Observer;

	var Observable = {

		//=========================================================================
		// constructor
		
		constructor: function (kwArgs) {
			// Either the base class store/_base/_Natural or store/_base/_Indexed is
			// required.
			if (this.features.has("indexed") || this.features.has("natural")) {
				this._observers = [];			// List of available Observer instances
				this._revision  = 0;

				// Listen for store update events.
				this.on("new, delete, change", this._onupdate );
				this.on("clear", this._onclear );

				this.features.add("observable");
				this.observable = true;
				
				Lib.protect( this );		// Hide own private proeprties.
			} else {
				throw new StoreError( "MethodMissing", "constructor", "base class '_Natural' or '_Indexed' must be loaded first");
			}
		},
		
		//=========================================================================
		// Private methods

		_onupdate: function (event) {
			// summary:
			//		Event handler. This handler is called each time the content of the
			//		store is altered, that is, an addition, an update or a deletion was
			//		made.
			// event:
			//		DOM4 style custom event.
			// tag:
			//		private

			var evtType = event.type;
			var object  = event.detail.item;
			var objKey  = this.getIdentity(object);
			var oldObj;
			
			this._revision++;
			
			this._observers.forEach( function ( observer ) {
				oldObj = observer.updater(evtType, objKey, object);
			}, this);
		},

		_onclear: function (event) {
			// summary:
			//		Event handler. This handler is called when the store is cleared.
			//		Clearing the store effectively renders all queries and observers
			//		invalid.
			// event:
			//		DOM4 style custom event.
			// tag:
			//		private

			this._revision++;		// This will render any query out-of-date.

			var observers = this._observers.slice(); 
			observers.forEach( function (observer) {
				observer.clear();
			}, this);
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
				this._revision++;
				
				this._observers.forEach( function ( observer ) {
					observer.updater(evtType, key, object);
				}, this);
			} else {
				throw new StoreError( "DataError", "notify" );
			}
		},

		query: function (/*Object*/ query,/*Store.QueryOptions*/ options ) {
			// summary:
			//		Queries the store for objects.
			// query: Object
			//		The query to use for retrieving objects from the store.
			// options:
			//		The optional arguments to apply to the resultset.
			// returns: dojo/store/api/Store.QueryResults
			//		The results of the query, extended with iterative methods.
			// tag:
			//		Public

			function createObserver () {
				// summary:
				//		Get the Observer instance associated with the query results.
				//		If no Observer is available one is create in the context of
				//		the query method.
				// tag:
				//		Private

				if (!observer) {
					observer = new Observer( { store: store, 
																		 query: query, 
																		 options: options, 
																		 results: results, 
																		 revision: store._revision 
																	});
					// Subscribe to the Observer's 'release' event so we can clear the
					// local reference once the observer is removed from the store.
					observer.on("release", function (event) {
						observer = null;
					});
					store._observers.push( observer );
				}
				return observer;
			}

			function observe (/*Function*/ listener,/*Boolean?*/ includeUpdates, /*Object*/ thisArg ) {
				// summary:
				//		This observe method is added to the query results, that is, if 
				//		the query results has a forEach method. When called the listener
				//		is registered with the query Observer.
				// listener:
				//		The callback called when the query results changed or when an
				//		object being part of the query results has changed.
				// includeUpdates:
				//		If true, the listener will also be called when an object that is
				//		part of the query result has changed.
				// thisArg:
				//		Object to use as this when executing callback.
				// returns:
				//		An object with a remove() method. The remove method can be called
				//		to remove the listener from the Observer object.
				// tag:
				//		Public
				
				var observer = createObserver();
				var options  = {updates: !!includeUpdates };

				listener = new Listener("observe", listener, options, thisArg);
				observer.addListener(listener);

				return {
					remove: function () { 
						observer.removeListener( listener ); 
					}
				};
			}	/* end observe() */

			// Call 'parent' query 
			var results  = this.inherited(arguments);
			var options  = options || {};
			var store    = this;
			var observer = null;
			
			// Test if the results can be iterated.
			if (results && typeof results.forEach == "function") {
				results.observe = observe;
			}
			return results;
		}

	};	/* end Observable {} */
	
	return declare( null, Observable);

});	/* end define() */
