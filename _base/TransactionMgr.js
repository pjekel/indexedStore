//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/lang",
				"./Library",
				"./Transaction",
				"../dom/event/EventTarget",
				"../util/shim/Array"
			 ], function (lang, Lib, Transaction, EventTarget) {
	"use strict";

	// module:
	//		IndexedStore/_base/TransactionMgr
	// summary:
	//		This module implements the synchronous Transaction Manager and replaces
	//		the IDBDatabase.transaction() interface. Note, the use of Transactions
	//		is not required or enforced to interface with an Object Store or Index.
	//		However, using transactions allows you to restrict concurrent access to
	//		a store based on the transaction type. For a detailed description of
	//		Transactions please refer to:
	//
	//			http://www.w3.org/TR/IndexedDB/#transaction-concept
	//
	//	NOTE:
	//		The http://www.w3.org/TR/IndexedDB/ specifications state that in case of
	//		synchrounous transaction the application must wait until the transaction
	//		can be started according to the transaction lifetime rules. This however
	//		is not possible using JavaScript. Therefore, this Transaction Manager
	//		implements a hybrid model of synchronous and asynchronous transaction
	//		execution, that is, if a transaction can not be started immediately due
	//		to lifetime constraints the transaction is queued for later execution.
	//		For a detailed description of the Transaction lifecycle please refer to:
	//
	//			http://www.w3.org/TR/IndexedDB/#transaction-concept
	//
	//		In addition, because there is no database involved, just a collection
	//		of stores and indexes, there is no support for 'versionchange' type
	//		transactions.

	var debug = dojo.config.isDebug || false;
	var transId = 1;
	var IDLE    = 0,
			PENDING = 1,
			ACTIVE  = 2,
			DONE    = 4;

	var transactions = [];			// List of all transactions.
	var activeTrans  = [];			// List of active transactions.
	
	function TransManager () {
		// summary:
		//		This function implements a synchronous Transaction Manager. Please
		//		see the note above for additional information.
		// tag:
		//		Public

		function cleanup (event) {
			// summary:
			//		Cleanup all remnants of a transaction.  This method is called for
			//		every transaction regardless if the transaction was successful or
			//		was aborted.
			// event:
			//		DOM style event. (see store/dom/event)
			// tag:
			//		Private
			
			function removeFromList( list, transaction ) {
				var idx = list.indexOf(transaction);
				if (idx != -1) {
					list.splice(idx,1);
				}
			}
			var transaction = event.target;

			if (debug) { Lib.debug( "Trans: "+transaction.identity+" event: "+event.type);}

			// Remove transactions from the stores
			setStoreTransaction( transaction, true );

			removeFromList(activeTrans, transaction);
			removeFromList(transactions, transaction);
			startTransactions( transactions.slice(0) );
		}

		function execute ( transaction ) {
			// summary:
			//		Initiate the execution of a transaction.   Calling this method does
			//		not quarentee the transaction is actually started, it may be queued
			//		due to constraints on the current execution environment.
			// transaction:
			//		Transaction to execute.
			// tag:
			//		Private
			if (transaction instanceof Transaction) {
				if ( !(transaction._done || transaction._aborted) ) {
					// Add eventlisteners so we can cleanup on completion or abort.
					transaction.addEventListener("abort", cleanup );
					transaction.addEventListener("done", cleanup );

					transactions.push(transaction);
					transaction._state = PENDING;
					startTransactions( [transaction] );
				}
				return transaction;
			} else {
				throw new TypeError("Invalid transaction");
			}
		};
		
		function setStoreTransaction(/*Transaction*/ transaction,/*Boolean*/ clear )  {
			// summary:
			//		Set the transaction on the store(s). (e.g. associate the store(s)
			//		with this transaction).
			// transaction:
			//		The transaction the store(s) will belong to.
			// clear:
			//		If true the store transaction is cleared (transaction complete)
			//		otherwise it is set.
			// tag:
			//		Private
			for (var storeName in transaction._scope) {
				var store = transaction._scope[storeName];
				store.transaction = clear ? null :transaction;
			}
		}

		function startTransactions(/*Transaction[]*/ transList ) {
			// summary:
			//		Start transaction(s). The list of transactions is searched for all
			//		pending transactions, if any. Of those transactions the one's that
			//		do not violate the indexedDB transaction constraints are started
			//		sequentially.
			// transList:
			//		List of transactions to search.
			// tag:
			//		Private

			// TODO: Make sure we give ample time to read-write transactions even if
			//       we are flooded with read-only transactions...

			transList.forEach( function(transaction) {
				if (transaction._state == PENDING) {
					if( !violateConstraint( transaction )) {
						activeTrans.push(transaction);

						if (debug) { Lib.debug( "Trans: "+transaction.identity+" started");	}

						setStoreTransaction( transaction, false );
						transaction._state = ACTIVE;
						transaction._start();

					} else {
						// start the timer if specified.
						if (transaction._timeout > 0) {
							transaction._handle = setTimeout( function () {
								transaction._expired.call(transaction);
							}, transaction._timeout);
						}
					}
				}
			});
		}

		function violateConstraint( transaction ) {
			// summary:
			//		Test if a transaction would violate any of the lifetime transaction
			//		constraints given the currently active transactions.
			// transaction:
			//		Transaction to evaluate.
			// returns:
			//		True if the transaction violates any constraints otherwise false.
			// tag:
			//		Private

			function overlap(tranList, transaction) {
				// summary:
				//		Test if the scope of a transaction overlaps with any of the
				//		transactions in the given transaction list.
				// transaction:
				//		Transaction to evaluate.
				// returns:
				//		True is the transaction scope overlap otherwise false.
				// tag:
				//		Private
				return tranList.some( function(trans) {
					for (var storeName in transaction._scope) {
						if (storeName in trans._scope) {
							return true;
						}
					}
				});
			}

			if (activeTrans.length > 0) {
				switch (transaction.mode) {
					case "readonly":
						// Read-only transactions can run concurrent
						var rwTrans = activeTrans.filter( function(trans) {
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

		this.transaction = function (/*Store|Store[]*/ stores, /*Function*/ callback, 
																	/*String?*/ mode, /*Number?*/ timeout ) {
			// summary:
			//		The method creates a Transaction object representing the transaction
			//		and immediately tries to start the transaction. This method replaces
			//		the IDBDatabase.transaction interface.
			// stores:
			// 		The object stores in the scope of the new transaction.
			// callback:
			//		A callback which will be called with the newly created transaction.
			//		When the callback returns, the transaction is committed.
			// mode:
			//		The mode for isolating access to data inside the given object stores.
			//		If this parameter is omitted, the default access mode is "readonly".
			// timeout:
			//		Maximum time allowed to wait before the transaction can be started.
			//		If the transaction cannot be started before the timer expires the
			//		transaction is aborted and the error property is set to TimeOutError.
			// returns:
			//		void
			// example:
			//	|	require(["dojo/_base/declare",
			//	|	         "store/_base/_Store",
			//	|	         "store/_base/_Indexed",
			//	|	         "store/_base/TransactionMgr"
			//	|         ], function (declare, _Store, _Indexed, Manager) {
			//	|	  var myStore = declare([_Store, _Indexed]);
			//	|		var store = new myStore({name:"TheStore", keyPath:"id"});
			//	|	  Manager.transaction( store, function (transaction) {
			//	|	    var store = transaction.objectStore("TheStore");
			//	|			store.add( {id:"Bart", lastname:"Simpson"} );
			//	|			store.add( {id:"Lisa", lastname:"Simpson"} );
			//	|	                      ...
			//	|	  }, "readwrite" );
			// tag:
			//		Public

			if (arguments.length > 2) {
				if (typeof arguments[2] == "number") {
					timeout = arguments[2];
					mode    = "readonly";
				}
				if (typeof timeout != "number" || timeout < 0) {
					timeout = 0;
				}
			}
			var transaction = new Transaction( stores, callback, mode, timeout);
			execute( transaction );		
		}

		EventTarget.call(this);

	}	/* end TransManager() */

	TransManager.prototype = new EventTarget();
	TransManager.prototype.constructor = TransManager;

	// Make sure we have only one instance of TransManager
	var manager = lang.getObject( "dojo.store.TransactionMgr", false);
	if (!manager) {
		manager = lang.setObject("dojo.store.TransactionMgr", new TransManager());
	}

	return manager;
	
})	/* end define() */
