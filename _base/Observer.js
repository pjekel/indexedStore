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
				"dojo/Deferred",
				"dojo/when",
				"../_base/Keys",
				"../_base/KeyRange",
				"../_base/Library",
				"../error/createError!../error/StoreErrors.json",
				"../listener/Listener",
				"../listener/ListenerList"
			 ], function (declare, Deferred, when, Keys, KeyRange, Lib, createError, 
			               Listener, ListenerList) {
	"use strict";
	
	// module:
	//		store/_base/Observer
	// summary:
	//		An Observer monitors QueryResults objects for any changes as the result
	//		of store content changes. Whenever an object is added to or removed from
	//		the store or when object property values changed, the Observer inspects
	//		the QueryResults object to determine if the store changes have an impact
	//		on the QueryResults.
	//		If the latter is true, the QueryResults object is updated accordingly
	//		and all listeners registered with the Observer are notified.
	// NOTE:
	//		In general, Observers are not intented to simply monitor object property
	//		changes. If simply notification of changes to specific object properties
	//		is required use the Watch extension instead. The Watch extension carries
	//		a lot less overhead than Observers do.
	// IMPORTANT:
	//		In order for QueryResults to be observable the store MUST have a key
	//		path defined otherwise it is impossible to extract the key from the
	//		QueryResults objects.
	// example:
	//	|	require(["store/_base/Observer",
	//	|	                 ...
	//	|	        ], function (Observer, ... ) {
	//	|
	//	|	  function bingo (object, from, into) {
	//	|	    console.log( object.name+" was moved from: "+from+" to: "+to );
	//	|	  }
	//	|	                 ...
	//	|	  var query    = {hair:"none"};
	//	|	  var results  = store.query( query );
	//	|	  var observer = new Observer( store, results, query );
	//	|	  observer.done( function () {
	//	|	    observer = null;
	//	|	  });
	//	|	  var handle = observer.addListener( bingo, true );
	//	|	                 ...
	//	|	  var homer = store.get("Homer");
	//	|	  homer.hair = "blond";
	//	|	  store.put( homer );
	//	|	                 ...
	//	|	  handle.remove();	// Remove listener from the Observer.
	//	|	});
	//
	//	See the Observable extension for some implmentation examples.
	
	var StoreError = createError( "Observer" );		// Create the StoreError type.
	var isObject   = Lib.isObject;
	var isString   = Lib.isString;
	var clone      = Lib.clone;
	var move       = Lib.move;
	var undef;
	
	var C_TYPE  = ["query", "range"];					// Types of Listeners
	var C_QUERY = 0,													// QueryResult types
			C_RANGE = 1;

	function locate (source, results, key) {
		// summary:
		// 		Locate an object with a given key in an arry of objects.
		// source: Store|Index
		//		Instance of a Store or Index object.
		// results:
		//		An array of objects.
		// key: Key
		//		Key used to locate the object.
		// returns: Number
		//		If found the index number of the object otherwise -1.
		// tag:
		//		Private
		var idx, objKey;
		
		for (idx = 0; idx < results.length; idx++) {
			objKey = Keys.keyValue(source.keyPath, results[idx]);
			if (objKey != undef && source.uppercase) {
				objKey = Keys.toUpperCase(objKey);
			}
			if (!Keys.cmp(key, objKey)) {
				return idx;
			}
		}
		return -1;
	}

	function Observer (source, results, range, directives, revision) {
		// summary:
		//		An Observer is an object capable of monitoring query or range results
		//		of type indexedStore/util/QueryResults. The store methods that return
		//		a QueryResults object are: query() and getRange().
		// source: Store|Index
		// results: dojo.store.util.QueryResults
		//		The dataset to monitor
		// range: KeyRange|Object?
		//		If range is not a KeyRange object it is considered a query object.
		// directives: Any?
		//		Directives specific to the range argument. If range is a KeyRange
		//		then directives represents the range direction, otherwise	directives
		//		is considered a Store.QueryOptions object.
		// revision: Number?
		//		The store revision at the time the results (QueryResults) object
		//		resolved. If not specified the results object is checked for the
		//		revision property.
		// tag:
		//		Private
		"use strict";
		
		function clear () {
			// summary:
			//		This method is called when the store associated with this Observer
			//		is cleared or when the QueryResults object is out-of-date.
			//		Clearing a store immediately renders all observers for that store
			//		out-of-date.
			// tag:
			//		Private

			self.destroy();
		};
		
		function update (action, key, newObj, oldObj, at) {
			// summary:
			//		This method is called whenever the content of the store is updated,
			//		that is, when the store performed a write or delete operations.
			// action: String
			//		Store operation performed, either "write" or "delete"
			// key: Key
			//		Object key
			// newObj: Object
			//		The new object, that is, the value portion of a record. If null it
			//		indicates a record has been deleted from the store.
			// oldObj: Object
			//		The old object, that is, the value portion of a record. If null it
			//		indicates a new record was inserted into the store.
			// at: Number
			//		The store index number of the record containing newObj.
			// tag:
			//		Private, callback

			// Ignore update notifications until we have a revision number indicating
			// the QueryResults has been resolved.
			if (!revision) {
				return;
			}
			when( results, function (dataset) {
				if (++revision != store.revision) {
					// Store updates were made prior to observing the query or range results.
					clear();	// Cleanup
					var message = "Query or range is out of date due to previous store changes";
					throw new StoreError("InvalidState", "update", message);
				}
				var object  = newObj || oldObj;
				var added   = newObj && !oldObj;
				var deleted = !newObj;

				var atEnd   = true;
				var count   = dataset.length;
				var from    = !added ? locate(store, dataset, key) : -1;
				var temp    = from;
				var into    = -1;

				if (!deleted) {
					switch (obsType) {

						case C_QUERY:
							var atEnd = count != options.count;
							if (queryFnc) {
								// First test if the new/updated object matches the query to being
								// with. If so, go find it's new location in the results set.
								if (matches ? matches(newObj) : queryFnc([newObj]).length) {
									object = store._clone ? clone(newObj) : newObj;
									if (from < 0) {
										temp = dataset.push(object) - 1;
									} else {
										dataset[from] = object;
									}
									into = locate(store, queryFnc(dataset), key );
								}
							} else {
								// Store has no query engine !!!
								object = store._clone ? clone(newObj) : newObj;
								into = added ? dataset.length : from;
								if (into > -1) {
									dataset[into] = object;
								}
							}
							break;

						case C_RANGE:
							if (!index) {
								// A range is based on object keys and because the primary key of
								// an object can't change without deleting the object first, only
								// new objects can alter the range order.
								if (Keys.inRange(key, range)) {
									object = store._clone ? clone(newObj) : newObj;
									if (added) {
										for(into = 0; into < count; into++) {
											var match = Keys.cmp( key, store.getIdentity(dataset[into]) );
											if ((ascending && match < 0) || (!ascending && match > 0)) {
												break;
											}
										}
									} else {
										// It's an update therefore no change in object order.
										dataset[from] = object;
										into = from;
									}
								}
							} else {
								// TODO: Needs additional work
								var indexKey = Keys.keyValue(index.path, newObj);
								if (index.multiEntry && indexKey instanceof Array) {
									// Remove duplicate elements and invalid key values.
									indexKey = Keys.purgeKey( indexKey );
								}
							}
							break;
					}
				}
				// Move object into the correct location. If results is paginated and
				// the object was moved into the first or last position we assume it
				// belongs to either the previous or next page.
				if (from != into) {
					var increment = from == -1 ? 1 : (into == -1 ? -1 : 0);
					if ( (options.start > 0 && into == 0) || (!atEnd && into == dataset.length)) {
						dataset.splice(into, 1);
						into = -1;
					} else {
						move( dataset, temp, into, object );	// Insert, delete or relocate object.
					}
					// Update the total property. (results and dataset may be different
					// objects so do both).
					results.total = dataset.total = dataset.total + increment;
				}
				if (listeners.length && (from > -1 || into > -1)) {
					listeners.getByType( C_TYPE[obsType] ).forEach( function (lstn) {
						if (from != into || lstn.updates) {
							lstn.listener.call( lstn.scope, object, from, into);
						}
					});
				}
			});
		}
		
		//=======================================================================
		// Public methods

		this.addListener = function (listener, includeUpdates, scope) {
			// summary:
			//		Add a listener to the Observer. Observers can have many listeners
			//		but only one per callback therefore, adding multiple listeners
			//		with the same callback address has no effect.
			// listener: Listener|Function
			//		Instance of a Listener object or a function.
			// includeUpdates: Boolean?
			//		If true, the listener will also be notified when an object that
			//		is part of the results set has simply changed.
			// scope: Object?
			//		Object to use as 'this' when executing callback.
			// returns: Object
			//		An object with a remove() method. The remove() method is used to
			//		remove the listener from the Observer.
			// tag:
			//		Public
			
			if (destroyed) {
				throw new StoreError("InvalidState", "addListener", "Observer is destroyed");
			}
			if (listener instanceof Listener || listener instanceof Function) {
				listener = new Listener( listener, scope );
				listener.updates = !!includeUpdates;
				listeners.addListener( C_TYPE[obsType], listener );
				return {
					remove: function () {
						self.removeListener(listener);
					}
				}
			}
			throw new StoreError("TypeError", "addListener", "invalid listener type");
		};
		
		this.destroy = function () {
			// summary:
			//		Destroy the Observer. The observer de-register from the store and
			//		observer listeners are removed. After destroying the Observer no 
			//		new listeners can be added.
			// tag:
			//		Public
			listeners && listeners.destroy();
			updater   && updater.remove();
			cleaner   && cleaner.remove();
			updater = cleaner = null;
			// Observer is done, remove all listeners and release resources
			listeners = null;
			results   = null;
			store     = null;
			index     = null;
			range     = null;
			source    = null;
			
			destroyed = true;
			deferred.resolve();
		};
		
		this.done = function (callback) {
			// summary:
			//		Returns a promise which resolves as soon as the Observer is done,
			//		that is, when the last registered listener has been removed.
			// callback: Function?
			//		Function called when the Observer is done (released).
			// returns: dojo/promise/Promise
			//		A dojo/promise/Promise which resolves as soon as the last listener
			//		is removed from the Observer.
			// tag:
			//		Public
			if (callback) {
				if (typeof callback == "function") {
					return deferred.then(callback);
				} else {
					throw new StoreError("TypeError", "done", "callback is not a callable object");
				}
			}
			return deferred.promise;
		}

		this.getListeners = function () {
			// summary:
			//		Get the list of registered listeners.
			// returns: Array|null
			//		An array of Listeners or null if the Observer has been destroyed.
			// tag:
			//		Public
			return listeners && listeners.getByType(C_TYPE[obsType]);
		}
		
		this.removeListener = function (listener) {
			// summary:
			//		Remove an existing listener from the Observer. After removing the
			//		last registered listener de-register the Observer from the store.
			// listener: Listener
			//		Instance of a Listener object.
			// tag:
			//		Public
			if (listener instanceof Array) {
				listener.forEach( this.removeListener, this );
			} else {
				listeners.removeListener( C_TYPE[obsType],listener );
				if (!listeners.length) {
					self.destroy();
				}
			}
		}
		
		//=======================================================================
		
		if (source && (source.type == "store" || source.type == "index")) {
			if (source.type == "store") {
				var store = source;
				var index = null;
			} else {
				var store = source.store;
				var index = source;
			}
			if (store.keyPath == undef) {
				throw new StoreError( "DataError", "constructor", "store requires a key path to be observable" );
			}
		} else {
			throw new StoreError( "DataError", "constructor", "invalid source" );
		}
		
		// Try to determine the type of result set we are dealing with.
		var obsType = "keyRange" in results ? C_RANGE : C_QUERY;
		if (obsType == C_RANGE) {
			if (!(range instanceof KeyRange)) {
				if (range != undef) {
					if (!Keys.validKey(range)) {
						throw new StoreError( "TypeError", "constructor" );
					} else {
						range = KeyRange.only( source.uppercase ? Keys.toUpperCase(range) : range );
					}
				}
			}
			var direction = results.direction || directives || "next";
			var ascending = /^next/.test(direction) || false;
			var options   = {};
		} else {
			if (range == undef || isObject(range)) {
				var options = directives || {};
				var npOpts  = clone( options );
				npOpts.start = 0;
				npOpts.count = 0;

				var queryFnc = store.queryEngine && store.queryEngine( range, npOpts);
				var matches  = queryFnc && queryFnc.matches;
			} else {
				throw new StoreError( "DataError", "constructor", "invalid range argument" );
			}
		}

		// We must have a revision number somewhere. A revision number greater than
		// zero (0) is an indication the QueryResults has been resolved. Until then
		// all observations for the QueryResults will be postponed.

		if (!revision) {
			if ("revision" in results) {
				// Don't fetch the revision number until QueryResults resolves.
				when (results, function () {
					when (results.revision, function (revNum) {
						if (typeof revNum == "number") {
							revision = revNum;
						} else {
							throw new StoreError( "DataError", "constructor", "revision must be a number" );
						}
					});
				});
			} else {
				throw new StoreError( "DataError", "constructor", "missing revision number" );
			}
		}

		var listeners = new ListenerList();
		var deferred  = new Deferred();
		var destroyed = false;
		var self      = this;
		
		Lib.defProp( this, "results", {	get: function () {return results;},	enumerable: true });

		// Register observer callbacks with the store.
		var updater = store._register( "write, delete", update );
		var cleaner = store._register( "clear", clear );

	}
	
	return Observer;

});	/* end define() */
