//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["./Keys",
		"./KeyRange",
		"../error/createError!../error/StoreErrors.json"
	], function (Keys, KeyRange, createError) {
	"use strict";

	// module:
	//		IndexedStore/_base/_Assert
	// summary:

	var AssertError = createError("assert");			// Create the AssertError type.

	var assert = {

		index: function (index, caller, readWrite) {
			if (index._destroyed) {
				throw new AssertError("InvalidState", caller, "index has been destroyed");
			}
		},

		key: function (key, caller, required) {
			// summary:
			//		Assert key argument.
			// key: Key|KeyRange
			// caller: String
			//		Name of the calling function.
			// required: Boolean?
			// tag:
			//		protected
			if (key != null) {
				if (!(key instanceof KeyRange) && !Keys.validKey(key)) {
					throw new AssertError("DataError", caller, "invalid key specified");
				}
			} else if (required) {
				throw new AssertError("ParameterMissing", caller, "key is a required argument");
			}
		},

		store: function (store, caller, readWrite) {
			// summary:
			//		Assert store. Validate if the store hasn't been destroyed or,
			//		when the store is part of a transaction, the transaction is
			//		still active and of the correct type.
			// store: Store
			//		Store to be asserted (this)
			// caller: String
			//		Name of the calling function.
			// readWrite: Boolean?
			//		Indicates if the store operation requires read/write access.
			// tag:
			//		protected
			if (store._destroyed) {
				throw new AssertError("InvalidState", caller, "store has been destroyed");
			}
			if (store.transaction) {
				if (!store.transactional) {
					throw new AssertError("AccessError", caller);
				}
				if (!store.transaction.active) {
					throw new AssertError("TransactionInactive", caller);
				}
				if (store.transaction.mode === "readonly" && readWrite) {
					throw new AssertError("ReadOnly", caller);
				}
			} else {
				if (store.transactional) {
					throw new AssertError("AccessError", caller);
				}
			}
		}
	};
	return assert;
});
