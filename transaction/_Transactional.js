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
		"../_base/library",
		"../_base/opcodes",
		"../_base/Watcher",
		"../dom/event/EventTarget",
		"../dom/string/DOMStringList",
		"../listener/ListenerList",
		"../error/createError!../error/StoreErrors.json",
		"./_Transaction"
	], function (Deferred, lib, opcodes, Watcher, EventTarget, DOMStringList, ListenerList,
				 createError, Transaction) {
	"use strict";

	// module
	//		indexedStore/transaction/_Transactional
	// summary:

	var C_MSG_NOTSUPPORTED = "operation %{0}() not supported in a transaction";

	var StoreError = createError("Transactional");		// Create the StoreError type.
	var defProp    = lib.defProp;
	var clone      = lib.clone;

	var storeEvents = ["clear", "close", "delete", "error", "load", "new", "update"];
	var notAllowed  = ["close", "destroy"];

	function Transactional() {}

	Transactional.done = function (transaction) {
		// summary:
		//		Clear the transaction.
		// transaction: Transaction
		// keepAlive: Boolean?
		//		If true, the transaction is not considered completely done, as a
		//		result the current _done state is preserved.
		// tag:
		//		public
		var name;

		function release(cs) {
			cs._listeners.removeListener();
			cs._records = null;
			cs._indexes = null;
			cs._index   = {};
		}

		if (transaction.active) {
			if (transaction._handle) {
				clearTimeout(transaction._handle);
				transaction._handle = null;
			}
			// Remove transaction from parent store(s)
			for (name in transaction._scope) {
				transaction._scope[name].clone = release(transaction._scope[name].clone);
				transaction._scope[name].parent.transaction = null;
			}
		}
		transaction._done    = true;
		transaction._state   = Transaction.DONE;
		transaction._scope   = {};
		transaction._oper    = [];
		transaction._promLst = [];

		transaction.active = false;
		transaction.error  = null;
	};

	Transactional.commit = function (transaction) {
		// summary:
		// transaction: Transaction
		// tag:
		//		public

		function mergeIndexes(mStore, tStore) {
			var index, names = Object.keys(tStore._indexes);
			names.forEach(function (name) {
				if (mStore._indexes[name] !== undefined) {
					if (tStore._updates) {
						mStore._indexes[name]._records = tStore._indexes[name]._records;
					}
				} else {
					// New index was created...
					index = tStore._indexes[name];
					defProp(index, "parent", {value: mStore, enumerable: true, writable: false});
					defProp(index, "store", {value: mStore, enumerable: true, writable: false});
					mStore._indexes[name] = index;
					mStore.indexNames     = new DOMStringList(tStore.indexNames);
				}
			});
			names = Object.keys(mStore._indexes);
			names.forEach(function (name) {
				if (tStore._indexes[name] === undefined) {
					mStore.transaction = null;
					mStore.deleteIndex(name);
				}
			});
		}	/* end commitIndexes() */

		function mergeStore(clonedStore) {
			// summary:
			// clonedStore:
			// tag:
			//		private
			var tStore = clonedStore, mStore = tStore.master;
			// Only merge stores if we had store mutations.
			if (tStore._updates) {
				mStore._records = tStore._records;
				mStore.revision = tStore.revision;
				mStore.total    = mStore._records.length;
				// Test for the local index of a _Natural store.
				if (mStore._index) {
					mStore._index = clone(tStore._index);
				}
			}
			mergeIndexes(mStore, tStore);
		}	/* end mergeStore() */

		var name;
		for (name in transaction._scope) {
			mergeStore(transaction._scope[name].clone);
		}
	};

	Transactional.setup = function (transaction) {
		// summary:
		// transaction: Transaction
		// tag:
		//		public

		function cloneIndexes(indexes, store) {
			var ci, cis = {}, index, name;
			for (name in indexes) {
				index = indexes[name];
				ci = Object.create(index, {
					_indexReady: {value: new Deferred(), writable: true},
					_records: {value: index._records.slice(), writable: true},
					_updates: {value: 0, writable: true},
					master: {value: index, enumerable: true},
					cloned: {value: true, enumerable: true},
					store: {value: store, enumerable: true}
				});
				EventTarget.call(ci, store);
				index.ready(
					function () {
						ci._indexReady.resolve(ci);
					},
					ci._indexReady.reject
				);
				ci._indexReady.then(null, function (err) {
					var event = new Event("error", {error: err, bubbles: true});
					ci.dispatchEvent(event);
				});
				store._register("loadEnd, loadStart", ci._onLoadTrigger, ci);
				cis[name] = ci;
			}
			return cis;
		}

		function cloneStore(store, mode) {
			// summary:
			// tag:
			//		protected
			var cs, indexNames;

			if (store.cloned) {
				throw new StoreError("DataError", "_clone", "store is already a cloned instance");
			}
			cs = Object.create(store, {
				_listeners: {value: new ListenerList(), writable: true},
				_indexes: {value: cloneIndexes(store._indexes, store, mode), writable: true},
				_index: {value: clone(store._index), writable: true},
				_records: {value: store._records.slice(), writable: true},
				_updates: {value: 0, writable: true},
				transactional: {value: true, enumerable: true},
				master: {value: store, enumerable: true},
				cloned: {value: true, enumerable: true}
			});
			EventTarget.call(cs);
			cs._storeReay = cs._resetState();

			if (cs.watcher && cs.features.has("watcher")) {
				cs.watcher = new Watcher(cs);
			}

			// IMPORTANT: If ready() is called on a cloned store we have to make
			// sure the associated callbacks are called with the correct store,
			// that is, the cloned store and NOT the parent store.

			store.ready(
				function () {
					cs._storeReady.resolve(cs);
				},
				cs._storeReady.reject
			);

			// Disallow several store functions
			notAllowed.forEach(function (fncName) {
				cs[fncName] = function () {
					throw new StoreError("NotSupported", null, C_MSG_NOTSUPPORTED, fncName);
				};
			});

			// Register for the notifications associated with any of the store
			// operations. Capturing the notifications of the transactional store
			// allows for the population of the transaction journal which, if the
			// transaction is successful, will be played back for the parent store.

			cs._register(opcodes.toArray(), function (/* trigger *[,arg] */) {
				transaction._journal(cs, arguments);
			});

			return cs;
		}

		var name, entry;

		if (transaction._handle) {
			clearTimeout(transaction._handle);
			transaction._handle = null;
		}
		// Prepare the transaction scope.
		for (name in transaction._scope) {
			entry = transaction._scope[name];
			entry.clone = cloneStore(entry.parent, transaction.mode);
			entry.parent.transaction = transaction;
		}
	};

	return Transactional;
});	/* end define() */
