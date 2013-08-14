//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../_base/library",
		"../dom/event/EventTarget",
		"./_Transaction"
	], function (lib, EventTarget, Transaction) {
	"use strict";

	// module:
	//		indexedStore/transaction/Manager
	// summary:
	//		This module implements the indexedStore Transaction Manager replacing
	//		the IDBDatabase.transaction() interface. Note, the use of Transactions
	//		is not required to interface with an indexedStore or Index.
	//		For a detailed description of Transactions please refer to:
	//
	//			http://www.w3.org/TR/IndexedDB/#transaction-concept
	//
	//		In addition, because there is no database involved, just a collection
	//		of stores and indexes, there is no support for 'versionchange' type
	//		transactions.

	var	TRANSACTION_MANAGER = "indexedStore.TransactionMgr";
	var debug = dojo.config.isDebug || false;
	var transId = 1;

	var transactions = [];			// List of all transactions.
	var activeTrans  = [];			// List of active transactions.

	function TransactionManager() {
		// summary:
		//		This function implements the Transaction Manager. Please see the note
		//		above for additional information.
		// tag:
		//		Public

		function cleanup(event) {
			// summary:
			//		Cleanup all remnants of a transaction. Cleanup() is called for
			//		every transaction regardless if the transaction was successful,
			//		or aborted.
			// event: Event
			//		DOM style event. (see indexedStore/dom/event)
			// tag:
			//		private
			var trans = event.target;

			function removeFromList(list, transaction) {
				var idx = list.indexOf(transaction);
				if (idx != -1) {
					list.splice(idx, 1);
				}
			}

			if (debug) {
				var msg = "Trans: " + trans.tid + " " + event.type;
				if (trans.error) {
					msg += " (reason: " + trans.error.name + ")";
				}
				lib.debug(msg);
			}

			removeFromList(activeTrans, trans);
			removeFromList(transactions, trans);

			startTransactions(transactions.slice());
		}

		function execute(transaction) {
			// summary:
			//		Initiate the execution of a transaction. Calling this method does
			//		not quarentee the transaction is actually started, it may be queued
			//		due to constraints on the current execution environment.
			// transaction: Transaction
			//		Transaction to execute.
			// tag:
			//		private
			if (!(transaction instanceof Transaction)) {
				throw new TypeError("Invalid transaction");
			}
			if (transaction._state == Transaction.IDLE) {
				transaction._state = Transaction.PENDING;
				transactions.push(transaction);
				startTransactions([transaction]);
			}
			return transaction;
		}

		function startTransactions(transList) {
			// summary:
			//		Start transaction(s). The list of transactions is searched for all
			//		pending transactions, of those pending transactions the one's that
			//		do not violate the indexedDB transaction constraints are started.
			// transList: Transaction[]
			//		List of transactions to search.
			// tag:
			//		private

			// TODO: Make sure we give ample time to read-write transactions even if
			//       we are flooded with read-only transactions...

			transList.forEach(function (trans) {
				if (trans._state == Transaction.PENDING) {
					if (!violateConstraint(trans)) {
						trans._state = Transaction.ACTIVE;
						activeTrans.push(trans);
						setTimeout(function () {
							trans._start();
						}, 0);
					} else {
						// Transaction violates constraints, start the timer if specified.
						if (!trans._handle && trans._timeout > 0) {
							trans._handle = setTimeout(function () {
								trans.abort("Timeout");
							}, trans._timeout);
						}
					}
				}

			});
		}

		function violateConstraint(transaction) {
			// summary:
			//		Test if a transaction would violate any of the lifetime transaction
			//		constraints given the currently active transactions.
			// transaction: Transaction
			//		Transaction to evaluate.
			// returns: Boolean
			//		True if the transaction violates any constraints otherwise false.
			// tag:
			//		private

			function overlap(tranList, transaction) {
				// summary:
				//		Test if the scope of a transaction overlaps with any of the
				//		transactions in the given transaction list.
				// tranList: Transaction[]
				//		The list of transaction being searched for any overlap.
				// transaction: Transaction
				//		Transaction to evaluate.
				// returns: Boolean
				//		True is the transaction scope overlap otherwise false.
				// tag:
				//		private
				return tranList.some(function (trans) {
					var storeName;
					for (storeName in transaction._scope) {
						if (trans._scope[storeName]) {
							return true;
						}
					}
				});
			}

			if (activeTrans.length > 0) {
				switch (transaction.mode) {
					case "readonly":
						// Read-only transactions can run concurrent
						var rwTrans = activeTrans.filter(function (trans) {
														 return (trans.mode != "readonly");
													 });
						return overlap(rwTrans, transaction);
					case "readwrite":
						// A read-write transaction can only start if there is no other active
						// transaction or if its scope does not overlap other transactions.
						return overlap(activeTrans, transaction);
				}
			}
			return false;
		}

		this.transaction = function (stores, callback, mode, timeout, smart) {
			// summary:
			//		The method creates a Transaction object representing the transaction
			//		and immediately tries to start the transaction. This method replaces
			//		the IDBDatabase.transaction interface.
			// stores: Store|Store[]
			//		The object stores in the scope of the new transaction.
			// callback: Function
			//		A callback which will be called with the newly created transaction.
			//		When the callback returns, the transaction is committed.
			// mode: String?
			//		The mode for isolating access to data inside the given object stores.
			//		If this parameter is omitted, the default access mode is "readonly".
			// timeout: Number?
			//		Maximum time allowed to wait before the transaction can be started.
			//		If the transaction cannot be started before the timer expires the
			//		transaction is aborted and the error property is set to TimeOutError.
			// smart: Boolean?
			//		If true, smart journaling will is applied, that is, operations that
			//		cancel each out are automatically removed from the journal. Default
			//		is true.
			// returns: Transaction
			//		A new instance of a Transaction object.
			// example:
			//	|	require(["dojo/_base/declare",
			//	|	         "store/_base/_Store",
			//	|	         "store/_base/_Indexed",
			//	|	         "store/transaction/Manager"
			//	|         ], function (declare, _Store, _Indexed, Manager) {
			//	|	  var myStore = declare([_Store, _Indexed]);
			//	|		var store = new myStore({name:"TheStore", keyPath:"id"});
			//	|	  var trans = Manager.transaction(store, function (transaction) {
			//	|	    var store = transaction.objectStore("TheStore");
			//	|			store.add({id:"Bart", lastname:"Simpson"});
			//	|			store.add({id:"Lisa", lastname:"Simpson"});
			//	|	                      ...
			//	|	  }, "readwrite");
			//	|	  trans.oncomplete = function (event) {
			//	|	    console.log("Transaction successful");
			//	|	  };
			// tag:
			//		Public

			var args = arguments, timer = timeout, tmode = mode;
			if (args.length > 2) {
				if (typeof args[2] == "number") {
					timer = args[2];
					tmode = "readonly";
				}
			}
			var transaction = new Transaction(stores, callback, tmode, timer, smart);
			execute(transaction);
			return transaction;
		};

		this.uniqueId = function () {
			// summary:
			//		Get a unique transaction id.
			// returns: Number
			//		The transaction id.
			// tag:
			//		public
			return transId++;
		};

		EventTarget.call(this);

		// Listen for the transaction's abort and complete events. Note that the
		// complete event is trapped in the capture phase as it doesn't bubble.
		// We don't listen for errors as transaction errors are always followed
		// by an abort event.

		this.addEventListener("complete", cleanup, true);
		this.addEventListener("abort", cleanup, false);

	}	/* end TransactionManager() */

	TransactionManager.prototype = new EventTarget();
	TransactionManager.prototype.constructor = TransactionManager;

	// Make sure we have only one instance of TransactionManager
	var manager = lib.getProp(TRANSACTION_MANAGER, window);
	if (!manager) {
		manager = lib.setProp(TRANSACTION_MANAGER, new TransactionManager(), window);
	}
	return manager;
});	/* end define() */
