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
				"./Eventer",
				"./Library",
				"../dom/event/Event",
				"../dom/event/EventTarget",
				"../error/createError!../error/StoreErrors.json"
			 ], function (lang, Eventer, Lib, Event, EventTarget, createError) {
	"use strict";
	
	// module:
	//		IndexedStore/_base/Transaction
	// summary:
	//		This module implements the relevant parts of IDBTransaction. Note that
	//		the use of transactions is not required to interface with indexedstore
	//		or index.  The Transactions are provided as an option and can be used
	//		to restrict concurrent access to a store. Using transactions also adds
	//		the rollback capabilities.
	// NOTE:
	//		Transactions are created using the TransactionMgr interface instead of
	//		the IDBDatabase interface. See the IndexedStore/_base/TransactionMgr
	//		for additional details.
	
	var	TRANSACTION_MANAGER = "indexedStore.TransactionMgr";
	var StoreError = createError( "Transaction" );		// Create the StoreError type.
	
	var transId = 1;
	var IDLE    = 0,		// Transaction states
			PENDING = 1,
			ACTIVE  = 2,
			DONE    = 4;

	function abort (trans, error) {
		// summary:
		//		Abort a trans. Called as the result of an exception. To abort
		//		transactions programmatically use the Transaction.abort() function
		//		instead.
		// trans:
		//		Transaction being aborted.
		// error:
		//		Reason
		// tag:
		//		Private
		if (!trans._aborted && !trans._done) {
			trans.error    = error ? ((error instanceof Error) ? error : new StoreError( error )) : null;
			trans._aborted = true;
			trans._done    = true;
			trans._state   = DONE;
			trans.active   = false;
			trans._handle  = null;

			rollback(trans);		// rollback store mutations.
			
			// Explicitly specify the propagation path.
			trans.dispatchEvent( new Event("abort", {bubbles:true}), trans.manager );
		}
	}

	function commit (trans) {
		// summary:
		//		Commit the transaction.
		// description:
		//		Commit the transaction. If the stores associated with this transaction
		//		have a _commit() method it is called once for every operation that was
		//		executed as part of the transaction.
		// trans: Transaction
		//		The completed transaction.
		// tag:
		//		Private
		var operations = trans._oper;
		operations.forEach( function (oper) {
			var store = oper.shift();
			if (store._commit instanceof Function) {
				store._commit.apply( store, oper );
			}
		});

		trans._done  = true;
		trans._state = DONE;
		trans._oper  = [];
		trans.active = false;

		// Explicitly include the Transaction Manager in the propagation path.
		trans.dispatchEvent( new Event("complete", {bubbles:true}), trans.manager );
	};

	function rollback (trans) {
		// summary:
		//		Rollback store mutations.
		// description:
		//		Rollback store mutations. When a transaction is aborted, either due to
		//		an error or programmatically, rollback all known mutations that have
		//		been made as part of this transaction upto the point the transaction
		//		was aborted.
		// trans: Transaction
		//		The aborted transaction.
		// tag:
		//		private

		var operations = trans._oper.reverse();			// Reverse operations
		operations.forEach( function (oper) {
			var store = oper[0];
			oper[0] = trans;
			if (store._undo instanceof Function) {
				store._undo.apply( store, oper );
			}
		});
		trans._oper = [];
	}
	

	function Transaction (stores, callback, mode, timeout) {
		// summary:
		//		Implements the IDBTransactionSync interface
		// stores: Store|Stores[]
		//		The object stores in the scope of the new transaction.
		// callback: Function
		//		A callback which will be called with the newly created transaction.
		//		When the callback returns, the transaction is considered complete.
		// mode: String?
		//		The mode for isolating access to data inside the given object stores.
		//		If this parameter is not provided, the default access mode is "readonly".
		// timeout: Number?
		//		Maximum time allowed to wait before the transaction can be started.
		//		If the transaction can not be started before the timer expires an
		//		exception of type TimeOutError is thrown. Note, the timeout is NOT
		//		the maximum duration of the transaction. 
		// tag:
		//		Public

		this._aborted = false;
		this._done    = false;
		this._eventer = new Eventer( this, "abort, complete, error" );
		this._scope   = {};
		this._state   = IDLE;
		this._handle  = null;
		this._timeout = timeout || 0;
		this._oper    = [];
		
		this.tid      = transId++;
		this.active   = true;
		this.mode     = "readonly";
		this.manager  = Lib.getProp( TRANSACTION_MANAGER, window);
		
		//=========================================================================
		// Private function
		
		this._expired = function () {
			// summary:
			//		This method is called by the Transaction Manager whenever a timeout
			//		for the transaction was specified and the timer expired before the
			//		transaction could be started.
			// tag:
			//		Private
			abort( this, new StoreError( "Timeout" ));
		};

		this._journal = function (store /* , type, key, newVal, oldVal, oldRev, at, options */) {
			// summary:
			//		Append store mutation info to the operations stack.
			// description:
			//		Append store mutation info to the operations stack. The transaction
			//		doesn't care about the type of information as it is simply passed
			//		back to the store by either the commit() or rollback() methods. The
			//		only required argument is 'store'
			// store: Store
			//		The originating store.
			// tag:
			//		private
			this._oper.push( Array.prototype.slice.call(arguments) );
		};

		this._start = function () {
			// summary:
			//		Start the transaction (e.g call the user specified callback). If
			//		the callback throws an exception the transaction is aborted and 
			//		the exception is rethrown.
			// tag:
			//		Private
			var trans = this;
			// Cancel pending timer, if any.
			if (this._handle != null) {
				clearTimeout( this._handle );
				this._handle = null;
			}
			// NOTE:
			//		The transaction may have been aborted before we even get started
			//    therefore we must test the done flag one more time.
			if (callback && !trans._done) {
				try  {
					callback( trans );
					commit( trans );
				} catch (err) {
					abort( trans, err );
					throw err;
				} finally {
					// Let the transaction manager know we're done one way or the other.
					trans.dispatchEvent( new Event("done", {bubbles:true}), trans.manager );
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

		this.store = this.objectStore = function (name) {
			// summary:
			//		Returns a Store object representing an object store that is within
			//		the scope of this transaction.
			// name: String
			//		The name of requested object store.
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
			throw new StoreError( "DataError", "constructor", "store argument required");
		}
		// Hide private properties.
		Lib.protect(this);
	}

	Transaction.prototype = new EventTarget();
	Transaction.prototype.constructor = Transaction;

	// Declare operation types.
	Transaction.NEW    = 0;
	Transaction.DELETE = 1;
	Transaction.UPDATE = 2;
	Transaction.CLEAR  = 3;

	return Transaction;
	
})	/* end define() */
