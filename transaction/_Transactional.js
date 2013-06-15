//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/Deferred",
				"../_base/Eventer",
				"../_base/Library",
				"../dom/event/EventTarget",
				"../dom/string/DOMStringList",
				"../listener/ListenerList",
				"../error/createError!../error/StoreErrors.json",
				"./_opcodes"
			 ], function (Deferred, Eventer, Lib, EventTarget, DOMStringList, ListenerList,
			               createError, _opcodes) {
	"use strict";
	
	// module
	//		indexedStore/transaction/_Transactional
	// summary:

	var C_MSG_NOTSUPPORTED = "operation %{0}() not supported in a transaction";
	
	var StoreError = createError( "Transactional" );		// Create the StoreError type.
	var defProp    = Lib.defProp;
	var clone      = Lib.clone;

	var notAllowed = ["close", "destroy", "load", "setData"];
	var undef;
	
	function Transactional () {};

	Transactional.done = function (transaction) {
		// summary:
		//		Clear the transaction. 
		// transaction: Transaction
		// keepAlive: Boolean?
		//		If true, the transaction is not considered completely done, as a
		//		result the current _done state is preserved.
		// tag:
		//		public
		if (transaction.active) {
			transaction._handle && clearTimeout(transaction._handle);
			transaction._handle = null;
			
			for (var name in transaction._scope) {
				transaction._scope[name].parent.transaction = null;
				transaction._scope[name].clone = undef;
			}
			transaction._done    = true;
			transaction._state   = _opcodes.DONE;
			transaction._scope   = {};
			transaction._oper    = [];
			transaction._promLst = [];

			transaction.active = false;
			transaction.error  = null;
		}
	};

	Transactional.commit = function (transaction) {
		// summary:
		// transaction: Transaction
		// tag:
		//		public

		function mergeIndexes(pStore, tStore) {
			var index, names = Object.keys(tStore._indexes);
			names.forEach( function (name) {
				if (name in pStore._indexes) {
					pStore._indexes[name]._records = tStore._indexes[name]._records;
				} else {
					// New index was created...
					index = tStore._indexes[name];
					defProp(index, "parent", {value:pStore, enumerable:true, writable:false});
					defProp(index, "store", {value:pStore, enumerable:true, writable:false});
					pStore._indexes[name] = index;
					pStore.indexNames     = new DOMStringList(tStore.indexNames);
				}
			});
			names = Object.keys(pStore._indexes);
			names.forEach( function (name) {
				if (!(name in tStore._indexes)) {
					pStore.transaction = null;
					pStore.deleteIndex(name);
				}
			});
		}	/* end commitIndexes() */

		function mergeStore (clonedStore) {
			// summary:
			// clonedStore:
			// tag:
			//		private
			var tStore = clonedStore, pStore = tStore.parentStore;
			// Only merge stores if we had store mutations.
			if (tStore._updates) {
				pStore._records = tStore._records.slice();
				pStore.revision = tStore.revision;
				pStore.total    = pStore._records.length;
				// Test for the local index of a _Natural store.
				if (pStore._index) {
					pStore._index = clone(tStore._index);
				}
				mergeIndexes(pStore, tStore);
			}
		}	/* end commitStore() */

		var name, operCount = transaction._oper.length;
		if (operCount) {
			for (name in transaction._scope) {
				mergeStore(transaction._scope[name].clone);
			}
		}
	};
	
	Transactional.setup = function (transaction) {
		// summary:
		// transaction: Transaction
		// tag:
		//		public

		function cloneStore (store) {
			// summary:
			//		Return a cloned store suitable for the use inside a transaction. The
			//		store is refered to as the transaction store (tStore)
			// store:
			//		Store to be cloned.
			// tag:
			//		public

			function cloneIndexes( clonedStore ) {
				// summary:
				// tag:
				//		private
				var name, ci, cis = {}, indexes = clonedStore._indexes;
				for (name in indexes) {
					ci = Object.create(indexes[name]);
					ci._records = ci._records.slice();
					defProp(ci, "cloned", {value:true, enumerable: true, writable:false});
					defProp(ci, "store", {value:clonedStore, enumerable: true, writable:false});
					cis[name] = ci;
				}
				return cis;
			}	/* end cloneIndexes() */

			if (store && store.type == "store" && !store.cloned) {
				var cs;
				cs = Object.create(store);
				cs._storeReady = new Deferred();
				cs._listeners  = new ListenerList();
				cs._records    = cs._records.slice();
				cs._indexes    = cloneIndexes(cs);
				cs._index      = clone(cs._index);		// _Natural stores only...
				cs._updates    = 0;

				cs.indexNames  = new DOMStringList(cs.indexNames);
				cs.parent      = transaction;

				// IMPORTANT: If ready() is called on a cloned store we have to make
				// sure the associated callbacks are called with the correct store,
				// that is, the cloned store and NOT the parent store.
				
				store.ready(
					function () {	
						cs._storeReady.resolve(cs);
					}, 
					cs._storeReady.reject
				);

				defProp(cs, "parentStore", {value:store, enumerable: true, writable:false});
				defProp(cs, "cloned", {value:true, enumerable: true, writable:false});

				// Reset the event listeners for the cloned store so we don't call any
				// of the parent store listeners.
				EventTarget.call(cs);

				// If the store is eventable replace the 'Eventer'
				if (cs.eventable) {
					cs.eventer = new Eventer(cs, "clear, close, delete, error, load, new, update");
					defProp( cs, "_emit", {
						configurable: false,
						enumerable: true, 
						writable: true,
						value: cs.eventer.emit
					});
				}
				// Disallow store functions
				notAllowed.forEach( function (fncName) {
					cs[fncName] = function () {
						throw new StoreError("NotSupported", null, C_MSG_NOTSUPPORTED, fncName);
					};
				});
				return cs;

			} else {
			}
		}	/* end cloneStore() */

		var name;
		
		transaction._handle && clearTimeout(transaction._handle);
		transaction._handle = null;

		// Prepare the transaction scope. 
		for(name in transaction._scope) {
			var entry = transaction._scope[name];
			entry.parent.transaction = transaction;
			entry.clone = cloneStore(entry.parent);
		}
	};

	return Transactional;
})	/* end define() */
