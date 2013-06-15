//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/when",
				"dojo/promise/all",
				"../_base/Eventer",
				"../_base/Library",
				"../dom/event/Event",
				"../dom/event/EventTarget",
				"../listener/ListenerList",
				"../error/createError!../error/StoreErrors.json",
				"./_Transactional",
				"./_opcodes"
			 ], function (when, all, Eventer, Lib, Event, EventTarget, ListenerList,
			               createError, _Transactional, _opcodes) {
	"use strict";
	
	// module:
	//		IndexedStore/transaction/_Transaction
	// summary:
	//		This module implements the relevant parts of the IDBTransaction interface
	//		See http://www.w3.org/TR/IndexedDB/#transaction
	// description:
	//		This module implements the relevant parts of IDBTransaction. In contrast
	//		to the IndexedDB specs the use of transactions is optional and therefore
	//		not required to interface with an indexedstore or index.
	//		This module handles the instantiation and process flow of transactions,
	//		module indexedStore/transaction/_Transactional handles the setup and
	//		rundown of transactions.
	// NOTE:
	//		TRANSACTIONS ARE CREATED USING THE TansactionManager INTERFACE INSTEAD
	//		OF THE IDBDATABASE INTERFACE. SEE THE indexedStore/transaction/Manager
	//		MODULE FOR ADDITIONAL INFORMATION.
	//
	// interface:
	//		[Constructor((Store or sequence<Store>) stores, function callback, 
	//		              optional string mode, optional number timeout,
	//		              optional boolean smart)]
	//		interface Transaction : EventTarget {
	//			readonly	attribute	string 	mode;
	//			readonly	attribute	Error		error;
	//			readonly	attribute	boolean active;
	//			readonly	attribute	number	tid;
	//
	//			void abort ();
	//		  Store objectStore (string name);
	//			attribute EventHandler	onabort;
	//			attribute EventHandler	onerror;
	//			attribute EventHandler	oncomplete;
	//		};

	var	TRANSACTION_MANAGER = "indexedStore.TransactionMgr";
	var StoreError = createError( "Transaction" );		// Create the StoreError type.
	var debug = dojo.config.isDebug || false;
	var defProp    = Lib.defProp;
	var getProp    = Lib.getProp;
	
	var undef;
	
	function Transaction (stores, callback, mode, timeout, smart) {
		// summary:
		//		Implements the IDBTransaction interface
		// stores: Store|Stores[]
		//		The object stores in the scope of the new transaction.
		// callback: Function
		//		A callback which will be called with the newly created transaction.
		//		When the callback returns, the transaction is considered complete.
		// mode: String?
		//		The mode for isolating access to data inside the given object stores.
		//		If this parameter is not provided mode will default to 'readonly".
		// timeout: Number?
		//		Maximum time allowed to wait before the transaction can be started.
		//		If the transaction can not be started before the timer expires an
		//		exception of type TimeOutError is thrown. Note, the timeout is NOT
		//		the maximum duration of the transaction. Default is 0.
		// smart: Boolean?
		//		If true, smart journaling will is applied, that is, operations that
		//		cancel each out are automatically removed from the journal. Default
		//		is true.
		// tag:
		//		Public

		function abort (error) {
			// summary:
			//		Abort the transaction. Called as the result of an exception. To abort
			//		transactions programmatically call the Transaction.abort() function
			//		instead.
			// error: Error|String
			//		Reason
			// tag:
			//		Private

			if (!self._done) {
				_Transactional.done(self);
				if (error) {
					self.error = error instanceof Error ? error : new StoreError(error);
				}
				self.dispatchEvent( new Event("abort", {bubbles:true}));
			}
		}

		function commit (result) {
			// summary:
			//		Commit the transaction.
			// result: any
			// tag:
			//		Private
			
			if (!self._done) {
				if (result !== false) {

					// If any deferred requests have been submitted we need to wait for
					// all of them to resolve.  If any pending request is rejected the
					// transaction will be aborted.

					if (defReqs) {
						all(self._promLst).then( 
							function () {
								defReqs = 0;
								commit();
							}, 
							fireError
						);
						return;
					}
					
					var pStore, tStore, oper = self._oper.slice();

					// Merge the cloned store(s) back into their parent store(s)
					_Transactional.commit(self);
					_Transactional.done(self);
					
					// The complete event does not bubble and is not cancelable....
					var event = new Event("complete");
					self.dispatchEvent(event);

					// Finally, notify the parent store of all updates. Please note that
					// the parent store notifications are not part of the transaction.

					oper.forEach( function (vargs) {
						tStore = vargs[0];						// Transactional store
						pStore = tStore.parentStore;	// Parent store.
						pStore._notify.apply( pStore, vargs[1]  );
					});
				} else {
					// Execute a silent abort.
					_Transactional.done(self);
					self.dispatchEvent( new Event("complete") );
				}
			}
		}

		function fireError (err) {
			// summary:
			//		Fire an error event. An error occured during the processing of the 
			//		transaction, fire the error event and abort the transaction.
			// err: Error
			//		Error condition, typically an instance of Error.
			// tag:
			//		private
			if (!self._done) {
				var event = new Event("error", {error:err, bubbles:true, cancelable:true});
				if (self.dispatchEvent( event )) {
					abort(err);
				}
			}
		}

		//=========================================================================
		// Protected function
		
		this._journal = function (store, vargs) {
			// summary:
			//		Append store mutation info to the journaling stack. Journal entries
			//		are created only if the mutation was successful on the transaction
			//		(cloned) store. The parent store remains unchanged until the entire
			//		transaction is committed.
			// store: Store
			//		The originating (transactional) store.
			// vargs: any[]
			//		An array-like object of arguments. The arguments are as follows:
			//			[opType, key, newVal, oldVal, oldRev, at, options]
			// tag:
			//		protected
			if (!this._done) {
				var append = !!(this.active && vargs);
				if (append) {
					if (smart && vargs[0] == _opcodes.DELETE) {
						// Search for all previous operations in the same store and key.
						var ops = this._oper.filter( function (op) {
							return (op[0] == store && op[1][1] == vargs[1])
						});
						if (ops.length) {
							ops.forEach( function (op) {
								this._oper.splice( this._oper.indexOf(op), 1);
								if (op[1][0] == _opcodes.NEW) {
									append = false;
								}
								store._updates--;		// Credit the operation.
							}, this);
						}
					}
				}
				if (append) {
					this._oper.push( arguments );
					store._updates++;
				}
			} else {
				throw new StoreError( "TransactionInactive", "_journal");
			}
		};

		this._start = function () {
			// summary:
			//		Start the transaction (e.g call the user specified callback). If
			//		the callback throws an exception the transaction is aborted and 
			//		the exception is re-thrown. If the callback returns boolean false
			//		the transaction will complete successful but all operations are
			//		dismissed and no changes are made to the parent nor is there an
			//		error or abort event is dispatched.
			// tag:
			//		protected

			if (!this._done) {
				if (debug) { Lib.debug( "Trans: "+this.tid+" started");	}
				// Clone all stores part of the transaction 
				_Transactional.setup(this);
				try  {
					when( callback(this), commit, fireError );
				} catch (err) {
					fireError(err );
				}
			}
		};

		this._waitFor = function (defer) {
			// summary:
			//		Add a deferred to the list of deferred requests the transaction
			//		will have to wait for before it can be committed.
			// defer: dojo/promise/Promise
			// tag:
			//		protected
			if (!this._done) {
				defReqs = this._promLst.push(defer);
			}
		};

		//=========================================================================
		// Public methods
		
		this.abort = function () {
			// summary:
			//		Abort the transaction programmatically.
			// tag:
			//		public
			if ( !this._done ) {
				abort(null);
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
			//		public
			var scope = this._scope[name];
			if (scope) {
				if (scope.parent._destroyed || this._done) {
					throw new StoreError("InvalidState", "objectStore");
				}
				return scope.clone;
			}
			throw new StoreError("NotFound", "objectStore");
		};

		//=========================================================================

		var manager   = getProp( TRANSACTION_MANAGER, window);
		var eventer   = new Eventer( this, "abort, complete, error" );
		var smart     = smart != undef ? !!smart : true;
		var defReqs   = 0;
		var self      = this;
		
		this._done    = false;
		this._handle  = null;
		this._promLst = [];
		this._oper    = [];
		this._scope   = {};
		this._state   = _opcodes.IDLE;
		this._timeout = timeout || 0;
		
		this.tid      = manager.uniqueId();		// For debug only
		this.active   = true;
		this.mode     = "readonly";
		
		EventTarget.call(this, manager);

		if (!(typeof callback == "function")) {
			throw new StoreError("DataError", "constructor", "callback is not a callable object");
		}
		// Validate the transaction mode, default is "readonly".
		if (mode) {
			switch( mode ) {
				case "readwrite":
				case "readonly":
					this.mode = mode;
					break;
				default:
					throw new StoreError("TypeError", "constructor", "invalid mode specified");
			}
		}
		if (typeof this._timeout != "number" || this._timeout < 0) {
			throw new StoreError("DataError", "constructor", "invalid timeout");
		}

		if (stores) {
			if (!(stores instanceof Array)) {
				stores = [stores];
			}
			// Compile the scope of the transaction. The scope is a set of objects,
			// each object representing a store. The clone property of the object
			// isn't set until the transaction is actually started, this because the
			// store may still change while the transaction is pending.

			stores.forEach( function (store) {
				if (store.type == "store" && store.name) {
					this._scope[store.name] = {parent: store, clone: undef};
				} else {
					throw new StoreError( "TypeError", "constructor", "invalid store");
				}
			}, this );
		} else {
			throw new StoreError( "DataError", "constructor", "store argument required");
		}

		// Listen for errors from a store or its index. The default propagation path
		// of an error is: Index -> Store ->Transaction -> Manager
		
		this.addEventListener("error", function (event) {
			if (event.eventPhase != Event.AT_TARGET) {
				abort(event.error);
			}
		});

		Lib.writable(this, "tid, mode, parent", false);
		// Hide protected properties.
		Lib.protect(this);
	}	/* end Transaction() */

	Transaction.prototype = new EventTarget();
	Transaction.prototype.constructor = Transaction;

	return Transaction;
	
})	/* end define() */
