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
				"../_base/Callback",
				"../_base/Keys",
				"../_base/KeyRange",
				"../_base/Library",
				"../_base/Listener",
				"../dom/event/Event",
				"../dom/event/EventTarget",
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, when, Callback, Keys, KeyRange, Lib, Listener, 
			               Event, EventTarget, createError) {
	
	// module:
	//		store/_base/Observer
	// summary:
	
	var StoreError = createError( "Observer" );		// Create the StoreError type.
	var isObject   = Lib.isObject;
	var undef;
	
	var C_LISTENER = ["query", "range"];					// Types of listeners
	var C_QUERY = 0,															// QueryResult types
			C_RANGE = 1;

	function locate (/*Store*/ store,/*Object[]*/ results,/*Key*/ key) {
		// summary:
		// 		Locate an object with a given key in an arry of objects.
		var idx, objKey;
		
		for (idx = 0; idx < results.length; idx++) {
			objKey = Keys.keyValue(store.keyPath, results[idx]);
			if (objKey != undef && store.uppercase) {
				objKey = Keys.toUpperCase(objKey);
			}
			if (!Keys.cmp(key, objKey)) {
				return idx;
			}
		}
		return -1;
	}

	function move(/*Object[]*/ results,/*Number*/ from,/*Number*/ to,/*Object*/ object) {
		// summary:
		//		Insert, relocate or delete an object in an array of objects.
		if (from != -1) {
			results.splice(from,1);
		}
		if (to != -1) {
			to = from > -1 ? (from < to ? --to : to) : to;
			results.splice(to, 0, object);	// Insert new or updated object.
		}
	}

	function Observer (/*Store*/ source, /*QueryResult*/ results,/*KeyRange|Query*/ range, /*Object*/ directives, revision ) {
		// summary:
		//		An Observer is an object capable of monitoring query results and
		//		notify listeners of any changes. Query results are defined as an
		//		object of type dojo/store/util/QueryResults. IndexedStore methods
		//		that return a QueryResult object are: query() and getRange().
		// source:
		// results:
		// range:
		// directives:
		// tag:
		//		Private
		"use strict";
		
		this.addListener = function (type, listener) {
			return callbacks.add(type, listener);
		};
		
		this.getListener = function (type) {
			return callbacks.getByType(type);
		}
		
		this.removeListener = function (type, listener) {
			callbacks.remove(type,listener);
			if (!callbacks.length) {
				observer.clear();
			}
		}
		
		this.clear = function () {
			// summary:
			// tag:
			//		Private

			store._callbacks.remove( "write, delete", updater );
			store._callbacks.remove( "clear", cleaner );

			callbacks.clear();
			observer.dispatchEvent( new Event( "release" ));
		};
		
		this.update = function (/*Object*/ cbOpts,/*Key*/ key, /*Object*/ newObj,/*Object*/ oldObj,/*Number*/ at) {
			// summary:
			// cbOpts:
			// key:
			// newObj:
			// oldObj:
			// at:
			// tag:
			//		Private, callback
			return when( results, function (results) {
				if (++revision != store.revision) {
					// Store updates were made prior to observing the query results.
					observer.clear();	// Cleanup
					throw new StoreError("InvalidState", "updater", "Query is out of date due to previous store changes");
				}
				var added   = newObj && !oldObj;
				var deleted = !newObj;

				var count   = results.length;
				var atEnd   = count != options.count;
				var from    = (!added ? locate(store, results, key) : -1);
				var into    = -1;

				if (!deleted) {
					if (obsType == C_QUERY) {
						if (filter) {
							if (matches ? matches(newObj) : filter([newObj])) {
								if (added) {
									results.push(newObj);
								}
								into = locate(store, filter(results), key );
							}
						} else {
							into = added ? results.push(newObj) - 1 : from;
						}
					} else {
						if (index) {
							var indexKey = Keys.keyValue(index.path, newObj);
							if (index.multiEntry && indexKey instanceof Array) {
								// Remove duplicate elements and invalid key values.
								indexKey = Keys.purgeKey( indexKey );
							}
							// TODO:
						} else {
							// Primary keys can't change without deleting the object first,
							// therefore only new objects can impact a range.
							if (added && Keys.inRange(key, range)) {
								for(into = 0; into < count; into++) {
									var match = Keys.cmp( key, store.getIdentity(results[into]));
									if ((ascending && match < 0) || (!ascending && match > 0)) {
										break;
									}
								}
							} else {
								into = from;
							}
						}
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
					var cbByType = observer.getListener(C_LISTENER[obsType]);
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
				var store = source._store;
				var index = source;
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
				} else {
					range = KeyRange.unbound();
				}
			}
			var direction = directives || "next";
			var ascending = /^next/.test(direction) || false;
		} else {
			if (range == undef || isObject(range)) {
				var options = directives || {};
				var npOpts  = Lib.clone( options );
				npOpts.start = 0;
				npOpts.count = 0;

				var filter  = store.queryEngine && store.queryEngine( range, npOpts);
				var matches = filter && filter.matches;
			} else {
				throw new StoreError( "DataError", "constructor", "invalid range" );
			}
		}

		EventTarget.call(this);

		var callbacks = new Callback();
		var resivion  = revision;
		var observer  = this;
		var updater   = new Listener( this.update, null, source );
		var cleaner   = new Listener( this.clear, null, source );

		// Register the observer listeners with the store.
		store._callbacks.add( "write, delete", updater );
		store._callbacks.add( "clear", cleaner );
	}

	Observer.prototype = new EventTarget();
	Observer.prototype.constructor = Observer;
	
	return Observer;

});	/* end define() */
