//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/Deferred",
		"dojo/promise/Promise",
		"dojo/when",
		"../error/createError!../error/StoreErrors.json",
		"../listener/Listener",
		"../listener/ListenerList",
		"../util/sorter",
		"./Keys",
		"./KeyRange",
		"./library"
	], function (Deferred, Promise, when, createError, Listener, ListenerList,
				 sorter, Keys, KeyRange, lib) {
	"use strict";

	// module:
	//		store/_base/Observer
	// summary:
	//		An Observer monitors the results of a store query or range request for
	//		any changes due to store content changes.
	// description:
	//		Whenever an object is added to or removed from the store or when object
	//		property values changed, the Observer inspects the QueryResults object
	//		to determine if the store changes have an affect on the QueryResults.
	//		If the latter is true, the QueryResults object is updated accordingly
	//		and all listeners registered with the Observer are notified.
	// NOTE:
	//		In general, Observers are not intended to simply monitor object property
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
	//	|	        ], function (Observer, ...) {
	//	|
	//	|	  function bingo (object, from, into) {
	//	|	    console.log(object.name+" was moved from: "+from+" to: "+to);
	//	|	  }
	//	|	                 ...
	//	|	  var query    = {hair:"none"};
	//	|	  var observer = new Observer(store, query);
	//	|	  observer.done(function () {
	//	|	    observer = null;
	//	|	  });
	//	|	  var handle = observer.addListener(bingo, true);
	//	|	                 ...
	//	|	  var homer = store.get("Homer");
	//	|	  homer.hair = "blond";
	//	|	  store.put(homer);
	//	|	                 ...
	//	|	  handle.remove();	// Remove listener from the Observer.
	//	|	});

	var StoreError  = createError("Observer");		// Create the StoreError type.
	var isDirection = lib.isDirection;
	var isObject    = lib.isObject;
	var clone       = lib.clone;
	var mixin       = lib.mixin;
	var move        = lib.move;

	var C_MSG_OUT_OF_DATE = "Query or range is out of date due to previous store changes";

	var C_TYPE  = ["query", "range"];					// Types of Listeners
	var C_QUERY = 0,													// QueryResult types
		C_RANGE = 1;

	function locate(store, data, key, match) {
		// summary:
		//		Locate an object with a given key in an array of objects.
		// source: Store|Index
		//		Instance of a Store or Index.
		// data:
		//		An array of objects to search.
		// key: Key
		//		Key to locate in the objects array.
		// match: Boolean
		//		If true, an exact match is required.
		// returns: Number
		//		If found the index number of the object otherwise -1.
		// tag:
		//		Private
		var i, l = data.length, m = match, r;
		for (i = 0; i < l; i++) {
			r = Keys.cmp(key, store.getIdentity(data[i]));
			if ((m && !r) || (!m && r <= 0)) {
				return i;
			}
		}
		return m ? -1 : i;
	}

	function Observer(source, query, directives/*, results */) {
		// summary:
		//		An Observer is an object capable of monitoring query or range data
		//		of type indexedStore/util/QueryResults. The store methods that return
		//		a QueryResults object are: query() and getRange().
		// source: Store|Index
		// query: KeyRange|Object?
		//		If query is not a KeyRange object it is considered a query object.
		// directives: Any?
		//		Directives specific to the range argument. If range is a KeyRange
		//		then directives represents the range direction, otherwise	directives
		//		is considered a Store.QueryOptions object.
		// resutls: dojo.store.util.QueryResults?
		//		The dataset to monitor, only to be used by the Observable extension.
		// tag:
		//		Private

		var qFunc, matches, revision, chunked, sorted, chunkOff, chunkOn, cleaner,
			updater, master, view;
		var ascending = false;
		var destroyed = false;
		var obsType   = C_QUERY;
		var options   = directives || {};
		var results   = arguments[3];		// Reserved for Observable extension
		var store     = source;
		var index     = null;
		var self      = this;

		var listeners = new ListenerList();
		var deferred  = new Deferred();

		function clear() {
			// summary:
			//		This method is called when the store associated with this Observer
			//		is cleared.
			// tag:
			//		Private

			// TODO:
			//		Should we just destroy the Observer?. If so, how do we notify the
			//		listeners? -> trigger(view.slice(), Infinity, -1) maybe ???

			var at = 0, object = view.shift();

			while (object) {
				view.total--;
				trigger(object, at++, -1);
				object = view.shift();
			}
			when(master, function (dataset) {
				dataset.revision = store.revision;
				dataset.length   = 0;
				dataset.total    = 0;
			});
			// Re-sync revision number.
			revision = store.revision;
		}

		function initialize(dataset) {
			// summary:
			//		Initialize the Observer. This method is called when the Range or
			//		query result associated with this Observer resolves.
			// dataset: Object[]
			//		Array of all objects matching the query or range.
			// returns: Object[]
			//		Either dataset or a subset of dataset depending on the QueryOptions
			//		properties 'start' and 'count'.
			// tag:
			//		Private

			if (dataset.direction !== undefined) {
				obsType   = C_RANGE;
				ascending = /^next/.test(dataset.direction) || false;
			} else {
				obsType = C_QUERY;
				qFunc   = store.queryEngine && store.queryEngine(query, chunkOff);
				matches = qFunc && qFunc.matches;
			}
			revision = Number(dataset.revision) || 0;
			if (!revision) {
				throw new StoreError("DataError", "when", "dataset has no revision number");
			}
			// If the query requested a chunk, that is, a subset of the query or range
			// results, create view as a subset of the entire dataset, view and dataset
			// will represent two different objects.

			if (chunked) {
				view = sorter(dataset.slice(), chunkOn);
				if (obsType == C_RANGE) {
					view.direction = dataset.direction;
					view.keysOnly  = dataset.keysOnly;
				}
				view.total = dataset.total;
			} else {
				view = dataset;
			}
			return view;
		}

		function trigger(object, from, into) {
			// summary:
			//		Signal listeners an object was added to, or removed from,
			//		the view or an object already in view was updated.
			// object: Object
			//		The object that was either added, removed or updated.
			// from: Number
			//		The previous location of the object in the view. If 'from'
			//		equals -1 it indicates the object was added.
			// into: Number
			//		The new location of the object. -1 indicates the object was
			//		removed.
			// tag:
			//		Private
			if (object && listeners.length) {
				var lsByType = listeners.getByType(C_TYPE[obsType]);
				lsByType.forEach(function (lstn) {
					if (from != into || lstn.updates) {
						lstn.listener.call(lstn.scope, object, from, into);
					}
				});
			}
		}

		function update(action, key, newObj, oldObj) {
			// summary:
			//		This method is called whenever the content of the store is
			//		updated, that is, when the store performed a write or delete
			//		operations.
			// action: String
			//		Store operation performed, either "write" or "delete"
			// key: Key
			//		Object key
			// newObj: Object
			//		The new object, that is, the value portion of a record. null
			//		indicates a record was deleted from the store.
			// oldObj: Object
			//		The old object, that is, the value portion of a record. null
			//		indicates a new record was added to the store.
			// at: Number
			//		Index number of the store record containing newObj.
			// tag:
			//		Private, callback

			// Ignore notifications until we have a revision number indicating the
			// QueryResults has resolved.
			if (!revision) {
				return;
			}
			when(master, function (dataset) {
				if (++revision != store.revision) {
					// Store updates were made prior to observing the query or range
					// results.
					self.destroy();
					throw new StoreError("InvalidState", "update", C_MSG_OUT_OF_DATE);
				}
				var added   = !!(newObj && !oldObj);
				var deleted = !!(!newObj && oldObj);

				var from  = !added ? locate(store, dataset, key, true) : -1;
				var into  = -1;

				if (!deleted) {
					if (obsType == C_QUERY) {
						// Test if the new or updated object affects the dataset.
						if (matches ? matches(newObj) : qFunc([newObj]).length) {
							if (from == -1) {
								// New object added to dataset, find location based on key.
								into = locate(store, dataset, key, false);
								dataset.splice(into, 0, newObj);
								dataset.total++;
							} else {
								// Existing object in dataset updated
								dataset[from] = newObj;
								into = from;
							}
							if (sorted) {
								sorter(dataset, chunkOff);
								into = dataset.indexOf(newObj);
							}
						}
					} else {
						if (!index) {
							// A range is based on object keys and because the primary key of
							// an object can't change without deleting the object first, only
							// new objects can alter the range order.
							if (Keys.inRange(key, query)) {
								if (added) {
									for (into = 0; into < dataset.length; into++) {
										var match = Keys.cmp(key, store.getIdentity(dataset[into]));
										if ((ascending && match <= 0) || (!ascending && match >= 0)) {
											break;
										}
									}
									dataset.splice(into, 0, newObj);
									dataset.total++;
								} else {
									// It's an update therefore no change in object order.
									dataset[from] = newObj;
									into = from;
								}
								if (sorted) {
									sorter(dataset, chunkOff);
									into = dataset.indexOf(newObj);
								}
							}
						} else {
							// TODO: Needs additional work
							var indexKey = Keys.keyValue(index.path, newObj);
							if (index.multiEntry && indexKey instanceof Array) {
								// Remove duplicate elements and invalid key values.
								indexKey = Keys.purgeKey(indexKey);
							}
						}
					}
				}

				if (into == -1) {
					if (from > -1) {
						dataset.splice(from, 1);
						dataset.total--;
					} else {
						return;
					}
				}

				// If a chunk was requested view and dataset are two different object
				// arrays. dataset represents ALL objects matching the query or range,
				// while view represents the subset of only those objects matching the
				// requested page (e.g. a view).  If no chunking is required view and
				// dataset will reference the same object array.

				if (chunked) {
					var start = options.start, count = options.count;
					var size  = count ? start + count : dataset.length;
					view.total = dataset.total;
					// Dismiss all updates strictly in front or behind the current view.
					if (((into > -1 && into < size) || (from > -1 && from < size))) {
						if (into > -1 && into < start && from > -1 && from < start) {
							return;
						}
						if (into >= start && into < size && from >= start && from < size) {
							// An update strictly within the current view, therefore the
							// view won't shift.
							into = into - start;
							from = from - start;
							move(view, from, into, newObj);
							trigger(newObj, from, into);
							return;
						}
						// An object was inserted or removed before the end of the view,
						// as a result the view will change one way or another.
						var newView = sorter(dataset.slice(), chunkOn);

						// First, signal the object removed from the current view, this
						// guarantees the view will never exceed the maximum count limit
						if (from > -1 || (count && view.length == count)) {
							view.some(function (obj, idx) {
								if (newView.indexOf(obj) == -1) {
									view.splice(idx, 1);
									trigger(obj, idx, -1);
									return true;
								}
							});
						}
						// Next, signal the object added to the view, if any.
						if (into > -1 || (count && newView.length == count)) {
							newView.some(function (obj, idx) {
								if (view.indexOf(obj) == -1) {
									view.splice(idx, 0, obj);
									trigger(obj, -1, idx);
									return true;
								}
							});
						}
					}
				} else {
					trigger(newObj || oldObj, from, into);
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
			//		is part of the view has simply changed.
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
				listener = new Listener(listener, scope);
				listener.updates = !!includeUpdates;
				listeners.addListener(C_TYPE[obsType], listener);
				return {
					remove: function () {
						self.removeListener(listener);
					}
				};
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
			destroyed = true;

			if (listeners) { listeners.destroy(); }
			if (updater) { updater.remove(); }
			if (cleaner) { cleaner.remove(); }
			updater = cleaner = null;
			// Observer is done, remove all listeners and release resources
			listeners = null;
			source    = null;
			view      = null;
			store     = null;
			index     = null;

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
				if (typeof callback != "function") {
					throw new StoreError("TypeError", "done", "callback is not a callable object");
				}
				return deferred.then(callback);
			}
			return deferred.promise;
		};

		this.getListeners = function () {
			// summary:
			//		Get the list of registered listeners.
			// returns: Array|null
			//		An array of Listeners or null if the Observer has been destroyed.
			// tag:
			//		Public
			return listeners && listeners.getByType(C_TYPE[obsType]);
		};

		this.removeListener = function (listener) {
			// summary:
			//		Remove an existing listener from the Observer. After removing the
			//		last registered listener de-register the Observer from the store.
			// listener: Listener
			//		Instance of a Listener object.
			// tag:
			//		Public
			if (listeners && listeners.length) {
				if (listener instanceof Array) {
					listener.forEach(this.removeListener, this);
				} else {
					listeners.removeListener(C_TYPE[obsType], listener);
					if (!listeners.length) {
						self.destroy();
					}
				}
			}
		};

		//=======================================================================

		// First, validate the source object.
		if (source && (source.type == "store" || source.type == "index")) {
			if (source.type == "index") {
				store = source.store;
				index = source;
			}
			if (store.keyPath == null) {
				throw new StoreError("DataError", "constructor", "store requires a key path to be observable");
			}
		} else {
			throw new StoreError("DataError", "constructor", "invalid source");
		}

		// Second, setup the options object and chunking parameters
		options  = isDirection(options) ? {direction: options} : options;
		options  = mixin({start: 0, count: 0}, options);

		sorted   = !!(options.sort);
		chunked  = !!(options.start || options.count);
		chunkOff = mixin(clone(options), {start: 0, count: 0});
		chunkOn  = {start: options.start, count: options.count};

		// Third, if no results was specified determine what we need to observe
		if (results) {
			if (!(results instanceof Array || results instanceof Promise)) {
				throw new StoreError("DataError", "constructor", "invalid RESULTS argument");
			}
			master = results;
		} else {
			if (query) {
				if (query instanceof KeyRange || isObject(query)) {
					obsType = query instanceof KeyRange ? C_RANGE : C_QUERY;
				} else {
					throw new StoreError("DataError", "constructor", "invalid query argument");
				}
			} else {
				if (isObject(options) && options.direction) {
					obsType = C_RANGE;
				}
			}
			if (obsType == C_RANGE) {
				master = source.getRange(query, chunkOff);
			} else {
				master = source.query(query, chunkOff);
			}
			when(master, function (dataset) {
				dataset.revision = dataset.revision || store.revision;
			});
		}
		// When master dataset resolves initialize the Observer.
		view = when(master, initialize);

		lib.defProp(this, "data", {	get: function () {return view; }, enumerable: true });

		// Register observer callbacks with the store.
		updater = store._register("write, delete", update);
		cleaner = store._register("clear", clear);
	}
	return Observer;
});	/* end define() */
