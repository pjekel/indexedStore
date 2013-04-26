//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["./Library",
				"./TransactionMgr",
				"../dom/event/Event",
				"../dom/event/EventTarget",
				"../error/createError!../error/StoreErrors.json"
			 ], function (Lib, TransManager, Event, EventTarget, createError) {
	"use strict";
	
	// module:
	//		IndexedStore/_base/Transaction
	// summary:
	//		This module implements the relevant parts of IDBTransactionsSync. Note
	//		that the use of transactions is not required to interface with a store
	//		or index. The Transactions are provided as an option and can be used to
	//		restrict concurrent access to a store.
	//		The implementation currently does not support rollback and Transactions
	//		are created using the TransactionMgr interface instead of the IDBDatabase
	//		interface. See IndexedStore/_base/TransactionMgr for additional details.
	
	var StoreError = createError( "Transaction" );		// Create the StoreError type.
	var debug = dojo.config.isDebug || false;
	
	var transId = 1;
	var IDLE    = 0,		// Transaction states
			PENDING = 1,
			ACTIVE  = 2,
			DONE    = 4;

	function abort (transaction, error) {
		// summary:
		//		Abort a transaction. Called as the result of an exception. To abort
		//		transactions programmatically use the Transaction.abort() function
		//		instead.
		// transaction:
		//		Transaction being aborted.
		// error:
		//		Reason
		// tag:
		//		Private
		if (!transaction._aborted && !transaction._done) {
			transaction.error = error ? ((error instanceof Error) ? error : new StoreError( error )) : null;
			transaction._aborted = true;
			transaction._done    = true;
			transaction._state   = DONE;
			transaction.active   = false;
			transaction._handle  = null;

			transaction.dispatchEvent( new Event("abort", {bubbles:true}) );
		}
	}

	function complete (transaction) {
		// summary:
		//		Transaction complete, update the transaction state and fire the 'done'
		//		event.
		// transaction:
		// tag:
		//		Private
		transaction._done  = true;
		transaction._state = DONE;
		transaction.active = false;

		transaction.dispatchEvent( new Event("done", {bubbles:true}) );
	}

	function Transaction (/*Store|Store[]*/ stores, /*Function*/ callback, /*String?*/ mode, /*Number*/ timeout ) {
		// summary:
		//		Implements the IDBTransactionSync interface
		// stores:
		//		The object stores in the scope of the new transaction.
		// callback:
		//		A callback which will be called with the newly created transaction.
		//		When the callback returns, the transaction is considered complete.
		// mode:
		//		The mode for isolating access to data inside the given object stores.
		//		If this parameter is not provided, the default access mode is "readonly".
		// timeout:
		//		Maximum time allowed to wait before the transaction can be started.
		//		If the transaction can not be started before the timer expires an
		//		exception of type TimeOutError is thrown. Note, the timeout is NOT
		//		the maximum duration of the transaction. 
		// tag:
		//		Public

		var callback = callback;

		this._aborted = false;
		this._done    = false;
		this._scope   = {};
		this._state   = IDLE;
		this._handle  = null;
		this._timeout = timeout || 0;
		
		this.identity = "trans_" + transId++;
		this.active   = true;
		this.mode     = "readonly";
		
		//=========================================================================
		// Private function
		
		this._expired = function () {
			// summary:
			//		This method is called whenever a timeout for the transaction was
			//		specified and the timer expired before the transaction could be
			//		started.
			// tag:
			//		Private
			abort( this, new StoreError( "Timeout" ));
		},

		this._start = function () {
			// summary:
			//		Start the transaction (e.g call the user specified callback). If
			//		the callback throws an exception the transaction is aborted and 
			//		the exception is rethrown.
			// tag:
			//		Private
			var transaction = this;
			// Cancel pending timer, if any.
			if (this._handle != null) {
				clearTimeout( this._handle );
				this._handle = null;
			}
			// NOTE:
			//		The transaction may have been aborted before we even get started
			//    therefore we must test the done flag one more time.
			if (callback && !transaction._done) {
				try  {
					callback( transaction );
					complete( transaction );
				} catch (err) {
					abort( transaction, err );
					throw err;
				}
			}
		};

		//=========================================================================
		// Public methods
		
		this.abort = function () {
			// summary:
			//		Abort the transaction programmatically.
			// tag:
			//		Public
			if ( !(this._done || this._aborted) ) {
				abort(this,null);
			} else {
				throw new StoreError("InvalidStateError", "abort", "Transaction already committed or aborted.");
			}
		};

		this.objectStore = function (/*String*/ name) {
			// summary:
			//		Returns a Store object representing an object store that is within
			//		the scope of this transaction.
			// name:
			//		The requested object store.
			// tag:
			//		Public
			var store = this._scope[name];
			if (store) {
				if (store._destroyed || this._done) {
					throw new StoreError("InvalidState", "objectStore");
				}
				return store;
			}
			throw new StoreError("NotFound", "objectStore");
		};

		//=========================================================================
		
		if (!(typeof callback == "function")) {
			throw new StoreError("DataError", "constructor", "callback is not a callable object");
		}

		// Validate the transaction mode, default is "readonly".
		if (mode) {
			switch( mode ) {
				case "readonly":
				case "readwrite":
					this.mode = mode;
					break;
				default:
					throw new StoreError("TypeError", "constructor", "invalid mode specified");
			}
		}
		if (stores) {
			if (!(stores instanceof Array)) {
				stores = [stores];
			}
			stores.forEach( function (store) {
				if (store.type == "store" && store.name) {
					this._scope[store.name] = store;
				} else {
					throw new StoreError( "TypeError", "constructor", "invalid store");
				}
			}, this );
		} else {
			stores = [];
		}
		// Hide private properties.
		Lib.protect(this);
	}

	Transaction.prototype = new EventTarget();
	Transaction.prototype.constructor = Transaction;

	return Transaction;
	
})	/* end define() */
