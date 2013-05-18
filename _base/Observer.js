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
				"../listener/ListenerList"
			 ], function (declare, Deferred, when, Keys, KeyRange, Lib, createError, 
			               ListenerList) {
	
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
	//	|	          store/_base/Listener",
	//	|	                 ...
	//	|	        ], function (Observer, Listener, ... ) {
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
	//	|	  var listener = new Listener( bingo, {updates: true} );
	//	|	  var listHndl = observer.addListener( listener );
	//	|	                 ...
	//	|	  var homer = store.get("Homer");
	//	|	  homer.hair = "blond";
	//	|	  store.put( homer );
	//	|	                 ...
	//	|	  listHndl.remove();	// Remove listener from the Observer.
	//	|	});
	//
	//	See the Observable extension for some implmentation examples.
	
	var StoreError = createError( "Observer" );		// Create the StoreError type.
	var isObject   = Lib.isObject;
	var undef;
	
	var C_LISTENER = ["query", "range"];					// Types of Listeners
	var C_QUERY = 0,															// QueryResult types
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

	function move (results, from, to, object) {
		// summary:
		//		Insert, relocate or delete an object in an array of objects.
		// results: Object[]
		//		An array of objects
		// from: Number
		//		If greater than -1 it indicates the current location of the object.
		// to: Number
		//		if greater than -1 it indicates the new location of the object.
		// object: Object
		//		The new object replacing the current object.
		// tag:
		//		Private
		if (from > -1) {
			results.splice(from,1);
		}
		if (to > -1) {
			to = from > -1 ? (from < to ? --to : to) : to;
			results.splice(to, 0, object);	// Insert new or updated object.
		}
	}

	function Observer (source, results, range, directives, revision) {
		// summary:
		//		An Observer is an object capable of monitoring query or range results
		//		of type dojo/store/util/QueryResults. IndexedStore methods that return
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
		//		was created. If not specified the results object is checked for a
		//		revision property.
		//		Note: the revision is not necessarily the current store revision.
		// tag:
		//		Private
		"use strict";
		
		this.addListener = function (listener) {
			// summary:
			//		Add a listener to the Observer. Observers can have many listeners
			//		but only one per callback therefore, adding multiple listeners
			//		who have the same callback address has no effect.
			// listener: Listener
			//		Instance of a Listener object.
			// returns: Object
			//		An object with a remove() method. The remove() method is used to
			//		remove the listener from the Observer.
			// tag:
			//		Public
			
			if (updater) {
				callbacks.addListener( C_LISTENER[obsType], listener );
				return {
					remove: function () {
						self.removeListener(listener);
					}
				}
			} else {
				throw new StoreError("InvalidState", "addListener", "Observer has been released");
			}
		};
		
		this.clear = function () {
			// summary:
			//		This method is called whenever the store at which the Observer is
			//		registered is cleared. Clearing a store immediately renders every
			//		Observer for that store out-of-date.
			// tag:
			//		Private

			// Remove the Observer callbacks from the store.
			updater.remove();
			cleaner.remove();

			callbacks.clear();
			updater  = null;
			cleaner  = null;
			revision = -1;

			deferred.resolve();
		};
		
		this.done = function (callback) {
			// summary:
			//		Returns a promise which resolves as soon as the Observer is done,
			//		that is, when the last registered listener has been removed.
			// callback: Function?
			//		Function called when the Observer is done (released).
			// returns: dojo/promise/Promise
			//		A dojo/promise/Promise which resolves assoon as the last listener
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
		
		this.removeListener = function (listener) {
			// summary:
			//		Remove an existing listener from the Observer. After removing the
			//		last registered listener the Observer is released.
			// listener: Listener
			//		Instance of a Listener object.
			// tag:
			//		Public
			callbacks.remove( C_LISTENER[obsType],listener );
			if (!callbacks.length) {
				self.clear();
			}
		}
		
		this.update = function (action, listener, key, newObj, oldObj, at) {
			// summary:
			//		This method is called whenever the content of the store changed.
			// action: String
			// listener: Listener
			// key: Key
			//		Object key
			// newObj: Object
			//		The new object, that is, the value portion of a record. If null it
			//		indicates the record has been deleted from the store.
			// oldObj: Object
			//		The old object, that is, the value portion of a record. If null it
			//		indicates a new record was inserted into the store.
			// at: Number
			//		The store index number of the record containing newObj.
			// tag:
			//		Private, callback
			return when( results, function (results) {
				if (++revision != store.revision) {
					// Store updates were made prior to observing the query results.
					self.clear();	// Cleanup
					throw new StoreError("InvalidState", "update", "Query or range is out of date due to previous store changes");
				}
				var added   = newObj && !oldObj;
				var deleted = !newObj;

				var count   = results.length;
				var from    = (!added ? locate(store, results, key) : -1);
				var atEnd   = true;
				var into    = -1;

				if (!deleted) {
					switch (obsType) {

						case C_QUERY:
							var atEnd = count != options.count;
							if (queryFnc) {
								// First test if the new/updated object matches the query to being with.
								// If so, go find it's new location in the results set.
								if (matches ? matches(newObj) : queryFnc([newObj])) {
									if (from < 0) {
										from = results.push(newObj) - 1;
									} else {
										results[from] = newObj;
									}
									into = locate(store, queryFnc(results), key );
								}
							} else {
								// Store has no query engine !!!
								into = added ? results.push(newObj) - 1 : from;
							}
							break;

						case C_RANGE:
							if (!index) {
								// A range is based on object keys and because the primary key of an object
								// can't change without deleting the object first only new objects can alter
								// the range order.
								if (added && Keys.inRange(key, range)) {
									for(into = 0; into < count; into++) {
										var match = Keys.cmp( key, store.getIndentity(results[into]) );
										if ((ascending && match < 0) || (!ascending && match > 0)) {
											break;
										}
									}
								} else {
									// It's an update therefore no change in object order.
									into = from;
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
				if (from != into) {
					if ( (options.start > 0 && into == 0) || (!atEnd && into == results.length)) {
						results.splice(into, 1);
						into = -1;
					} else {
						move( results, from, into, newObj );	// Insert, delete or relocate object.
					}
				}
				if (from > -1 || into > -1) {
					// Notify any listeners.
					var cbByType = callbacks.getByType( C_LISTENER[obsType] );
					cbByType.forEach( function (listener) {
						if (from != into || listener.options.updates) {
							listener.callback.call( listener.scope, newObj, from, into);
						}
					});
				}
			});
			
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
		} else {
			if (range == undef || isObject(range)) {
				var options = directives || {};
				var npOpts  = Lib.clone( options );
				npOpts.start = 0;
				npOpts.count = 0;

				var queryFnc = store.queryEngine && store.queryEngine( range, npOpts);
				var matches  = queryFnc && queryFnc.matches;
			} else {
				throw new StoreError( "DataError", "constructor", "invalid range argument" );
			}
		}

		// We must have a revision number somewhere....
		if (revision == undef) {
			if ("revision" in results && typeof results.revision == "number") {
				revision = results.revision;
			} else {
				throw new StoreError( "DataError", "constructor", "invalid or missing revision" );
			}
		}

		var callbacks = new ListenerList();
		var deferred  = new Deferred();
		var self      = this;
		
		// Register observer callbacks with the store.
		var updater = store._listeners.addListener( "write, delete", this.update, source );
		var cleaner = store._listeners.addListener( "clear", this.clear, source );
	}
	
	return Observer;

});	/* end define() */
