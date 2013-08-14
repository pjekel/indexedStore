define(["dojo/_base/declare",
		"dojo/has",
		"dojo/json",
		"../_base/library",
		"../_base/opcodes",
		"../error/createError!../error/StoreErrors.json"
	], function (declare, has, JSON, lib, opcodes, createError) {
//	"use strict";

	// module
	//		indexedStore/extension/WebStorage
	// summary:
	//		This extension adds persistent local storage to an indexedStore.
	// description:
	//		This extension adds persistent local storage to an indexedStore. The
	//		WebStorage extension can be used with both the _Indexed and _Natural
	//		base classes. The WebStorage extension fully supports transactions.
	//
	//		See http://www.w3.org/TR/webstorage/
	//
	// NOTE:
	//		Because webStorage is an external entity it is highly recommended to
	//		perform any store updates using transactions. The use of transactions
	//		guarantees the in-memory store and webStorage stay synchronized even
	//		if errors occur.
	//
	// example:
	//	|	require(["dojo/_base/declare",
	//	|	         "store/_base/_Store",
	//	|	         "store/_base/_Indexed",
	//	|	         "store/extension/WebStorage"
	//	|           ], function (declare, _Store, _Indexed, WebStorage) {
	//	|
	//	|	    var WebStore = declare([_Store, _Indexed, WebStorage]);
	//	|	    var myStore  = new WebStore({name: "myStore", keyPath: "name"});
	//	|	                  ...
	//	|	    myStore.onerror = function (event) {
	//	|	        console.log(event.error);
	//	|	    };
	//	|	                  ...
	//	|	    myStore.put({name: "Homer", lastName: "Simpson"});
	//	|	    var homer = myStore.get("Homer");
	//	|	    if (homer) {
	//	|	        console.log("Bingo");
	//	|	    }
	//	|	});
	//
	//		Same example using a transaction:
	//
	//	|	require(["dojo/_base/declare",
	//	|	         "store/_base/_Store",
	//	|	         "store/_base/_Indexed",
	//	|	         "store/extension/WebStorage",
	//	|	         "store/transaction/Manager"
	//	|           ], function (declare, _Store, _Indexed, WebStorage, Manager) {
	//	|
	//	|	    var WebStore = declare([_Store, _Indexed, WebStorage]);
	//	|	    var myStore  = new WebStore({name: "myStore", keyPath: "name"});
	//	|	                  ...
	//	|	    myStore.onerror = function (event) {
	//	|	        console.log(event.error);
	//	|	    };
	//	|	                  ...
	//	|	    var trans = Manager.transaction(myStore,
	//	|	        function (transaction) {
	//	|	            var tStore = transaction.store("myStore");
	//	|	            tStore.put({name: "Homer", lastName: "Simpson"});
	//	|           }, "readwrite");
	//	|
	//	|	    trans.oncomplete = function (event) {
	//	|	        var homer = myStore.get("Homer");
	//	|	        if (homer) {
	//	|	            console.log("Bingo");
	//	|	        }
	//	|	    };
	//	|	    trans.onabort = function (event) {
	//	|	        console.log(trans.error);
	//	|	    };
	//	|	});
	var StoreError = createError("WebStorage");		// Create the StoreError type.

	// Determine if the window object implements the WindowLocalStorage interface
	var webStorage = window.localStorage;
	var isIE = has('ie');

	var C_MSG_NAME_REQUIRED = "store requires a unique name";
	var C_MSG_NO_BASE_CLASS = "base class _Indexed or _Natural required";
	var C_MSG_NO_WEBSTORAGE = "no webStorage support detected";

	function loadLocal(storage, keyPrefix) {
		// summary:
		//		Load all matching key:value pairs from the window.localStorage object.
		//		This method is only called if no other loader is available.
		// Note:
		//		Due to the minimalistic nature of this method, all values
		//		loaded MUST be JSON encoded.
		// storage: window.localStorage
		// keyPrefix: String|RegExp
		// returns: Object[]
		// tag:
		//		private
		var regexp = (keyPrefix instanceof RegExp) ? keyPrefix : new RegExp("^" + keyPrefix || "");
		var i, key, value;
		var records = [];

		for (i = 0; i < storage.length; i++) {
			key = storage.key(i);
			if (regexp.test(key)) {
				value = JSON.parse(storage.getItem(key));
				key   = key.replace(regexp, "");
				if (value) {
					records.push({key: key, value: value});
				}
			}
		}
		return records;
	}

	var Storage = declare(null, {

		//===================================================================
		// Constructor

		constructor: function (kwArgs) {
			// summary:
			// kwArgs: Object?
			// tag:
			//		protected
			"use strict";

			if (!webStorage) {
				throw new StoreError("Dependency", "constructor", C_MSG_NO_WEBSTORAGE);
			}
			if (!kwArgs.name) {
				throw new StoreError("DataError", "constructor", C_MSG_NAME_REQUIRED);
			}
			this._keyPrefix = this.name + "::";
			this.features.add("storage");
		},

		postscript: function () {
			// summary:
			//		Called after all chained constructors have executed.
			// tag:
			//		protected, callback
			var loader = this.features.has("loader");
			var records;

			if (!this.features.has("indexed, natural")) {
				throw new StoreError("Dependency", "postscript", C_MSG_NO_BASE_CLASS);
			}

			// If no loader is available or the loader does not support webstorage
			// try populating the store using the loadLocal() method.
			if (loader && loader.features.has("webstorage")) {
				loader.keyPrefix = this._keyPrefix;
			} else {
				records = loadLocal(webStorage, this._keyPrefix);
				records.forEach(function (record) {
					this._storeRecord(record.value, {key: record.key, overwrite: true});
				}, this);
			}
			// Add event listener to the window object to handle out of bound
			// Storage updates, that is, updates performed by other documents.
			window.addEventListener('storage', this._webStorageEvent.bind(this), false);

			// Register handlers with the store to trap any applicable store
			// operations....
			this._register(opcodes.toArray(), this._webStorageUpdate, this);
			// and transaction triggers.
			this._register("reverse", this._webStorageReverse, this);
			this._register("commit", this._webStorageCommit, this);

			this.inherited(arguments);	// Call 'parent' postscript()
		},

		//===================================================================
		// protected methods.

		_webStorageCommit: function (action, transArgs) {
			// summary:
			//		Commit a single operation which is part of a transaction.
			// action: String
			//		Trigger type, always 'commit'
			// transArgs: any[]
			//		An array containing the notification arguments.
			//		See _Trigger._notify( ... )
			// tag:
			//		protected
			this._webStorageUpdate.apply(this, transArgs);
		},

		_webStorageEvent: function (event) {
			// summary:
			//		Event handler called when out-of-bound Storage updates occurred,
			//		that is, updates to the Storage object by other documents.
			// event: Event
			//		DOM StorageEvent.
			// tag:
			//		protected, callback
			var regexp   = new RegExp("^" + this._keyPrefix);
			var newValue = event.newValue || "";
			var oldValue = event.oldValue || "";
			var storeKey = event.key || "";
			var key, value;

			if (isIE) {
				// TODO: Windows fires events at EVERY window and due to latency
				// issues it may screw up either the webStorage or in-memory
				// store
				return;
			}
			// Several browsers dispatch 'storage' events which are not compliant
			// with the Web Storage specs however, the following works with most
			// major browsers (IE, FF, Chrome and Safari).
			if (storeKey === "" && newValue === "" && oldValue === "") {
				this.clear();
			} else {
				// Only handle those events that affect our store, that is, keys that
				// are prefixed with the store name.
				if (regexp.test(storeKey)) {
					if (newValue !== "") {
						value = JSON.parse(newValue);
						this._storeRecord(value, {overwrite: true, __webStored: true});
					} else if (oldValue !== "") {
						key = storeKey.replace(regexp, "");
						this._deleteKeyRange(key);
					}
				}
			}
		},

		_webStorageReverse: function (action, transArgs) {
			// summary:
			//		Reverse store operation. When an exception is thrown during a
			//		transaction commit, the transaction will trigger the 'reverse'
			//		procedure. See indexedStore/transaction/_Transaction.reverse()
			//		for more info.
			// action:
			//		Trigger type, always 'reverse'
			// transArgs: any[]
			//		An array containing the notification arguments.
			//		See _Trigger._notify( ... )
			// tag:
			//		protected
			this._webStorageUndo.apply(this, transArgs);
		},

		_webStorageUndo: function (opType, key, newVal, oldVal) {
			// summary:
			//		Undo (reverse) a successfully committed operation.
			// opType: String|Number
			//		Operation type (opcode)
			// key: Key
			//		Store record key
			// newVal: any?
			// oldVal: any?
			// tag:
			//		protected
			switch (opType) {
				case opcodes.NEW:
					this._webStorageUpdate(opcodes.DELETE, key);
					break;
				case opcodes.DELETE:
					this._webStorageUpdate(opcodes.NEW, key, oldVal);
					break;
				case opcodes.UPDATE:
					this._webStorageUpdate(opcodes.UPDATE, key, oldVal);
					break;
				case opcodes.CLEAR:
					oldVal.forEach(function (record) {
						this._webStorageUpdate(opcodes.NEW, record.key, record.value);
					}, this);
					break;
			}
		},

		_webStorageUpdate: function (opType, key, newVal, oldVal, at, options) {
			// summary:
			//		Perform the store mutation on the webStorage.
			// description:
			//		Perform the store mutation on the webStorage. If the update
			//		request was made as part of a transaction this method will be
			//		called twice, once as part of the transaction commit procedure
			//		and once when the notification is played back for the parent
			//		store after the commit procedure. To avoid double jeopardy the
			//		special flag __webStored is set on the first update call.
			// opType: String|Number
			//		Operation type (opcode)
			// key: Key?
			// newVal: any?
			// oldVal: any?
			// options: Object
			// tag:
			//		private
			var stored = options && options.__webStored;
			if (!stored) {
				switch (opType) {
					case opcodes.NEW:
					case opcodes.UPDATE:
						webStorage.setItem(this._keyPrefix + key, JSON.stringify(newVal));
						break;
					case opcodes.DELETE:
						webStorage.removeItem(this._keyPrefix + key);
						break;
					case opcodes.CLEAR:
						// Considering there is only one webStorage object per origin
						// we can't call webStorage.clear() because that would clear
						// the entire storage object. Instead delete only the keys that
						// are associated with this store.
						oldVal.forEach(function (record) {
							webStorage.removeItem(this._keyPrefix + record.key);
						}, this);
						break;
				}
				// Set the __webStored flag indicating the store update request has
				// been executed.
				lib.mixin(options, {__webStored: true});
			}
		}

	});
	return Storage;
});