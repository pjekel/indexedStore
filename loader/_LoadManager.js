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
		"../dom/event/Event",
		"../dom/event/EventTarget",
		"../error/createError!../error/StoreErrors.json",
		"./_fixError",
		"./_LoadRequest"
	], function (lib, Event, EventTarget, createError, fixError, LoadRequest) {
	"use strict";

	// module
	//		indexedStore/loader/_LoadManager
	// summary:
	//		The load manager handles the scheduling of load requests. Depending
	//		on the submission directives, requests may execute sequentially or
	//		concurrent.
	// interface:
	//		[Constructor(Loader loader)]
	//		interface LoadManager : EventTarget {
	//			void		_next(optional LoadRequest request);
	//			void		cancel((Error or DOMString)	reason);
	//			Deferred	submit(LoadRequest request, optional boolean async);
	//		};
	//
	//		Loader implements LoaderBase;

	var MSG_C_MISSING_METHOD = "loader is missing method [%{0}]";

	var StoreError = createError("LoaderManager");		// Create the StoreError type.
	var baseResp = Object.freeze({options: null, status: 0, text: ""});

	function LoadManager(loader) {
		// summary:
		//		Create a new instance of LoadManager
		// loader: Object
		//		An object derived from LoaderBase
		// returns: LoadManager
		// tag:
		//		public

		EventTarget.call(this, loader);

		var loading  = false;
		var activeQ  = [];
		var pendingQ = [];

		//====================================================================
		// Private methods

		function startRequest(loader, request) {
			// summary:
			//		Start the load request. The loader MUST support at least
			//		a '_getData' method and optionally a '_storeData' method.
			// request: LoadRequest
			//		Instance of LoadRequest
			// tag:
			//		private
			var funcName = "_" + request.type.toLowerCase() + "Data";
			var setter   = loader["_storeData"];
			var getter   = loader[funcName];
			var promise;

			if (request.origin) {
				if (getter) {
					request.defer.active = true;
					promise = getter.call(loader, request);
					promise.response.then(
						function (response) {
							try {
								if (!setter || setter.call(loader, request, response)) {
									request.success(response);
								}
							} catch (err) {
								err.response = lib.mixin(err.response, response, {status: 500});
								request.error(StoreError.call(err, err, "startRequest"));
							}
						},
						function (err) {
							err = fixError(err);
							request.error(StoreError.call(err, err, "startRequest"));
						}
					);
					// When defer fails or is canceled, cancel the associated promise.
					request.defer.then(null, promise.cancel);
				} else {
					throw new StoreError("TypeError", "startRequest", MSG_C_MISSING_METHOD, funcName);
				}
			} else {
				request.success(baseResp);
			}
		}

		function removeFromQueue(request) {
			// summary:
			//		Remove a load request from the queue.  This method is called
			//		whenever a load request completed successfully, failed or is
			//		canceled.
			// request: LoadRequest
			//		Instance of LoadRequest
			// tag:
			//		private
			var idx = activeQ.indexOf(request);
			if (idx > -1) {
				return activeQ.splice(idx, 1);
			}
			idx = pendingQ.indexOf(request);
			if (idx > -1) {
				return pendingQ.splice(idx, 1);
			}
			request.defer.request = null;
			request.defer.active  = false;
			request.done          = true;
		}

		//====================================================================
		// Protected methods

		this._next = function (request) {
			// summary:
			//		Start the execution of the next pending load request. If there
			//		no more pending requests an 'idle' event is dispatched.
			// request: LoadRequest
			//		Instance of LoadRequest
			// tag:
			//		private
			request = request || pendingQ.shift();
			if (request) {
				// The request may have been canceled
				if (!request.done) {
					request.dispatchEvent(new Event("active"));
					activeQ.push(request);
					loading = true;
					startRequest(loader, request);
				} else {
					this._next();
				}
			} else {
				loading = false;
				this.dispatchEvent(new Event("idle"));
			}
		};

		//====================================================================
		// Public methods

		this.cancel = function (reason) {
			// summary:
			//		Cancel all active and pending load requests.
			// request: LoadRequest
			//		Instance of LoadRequest
			// tag:
			//		public
			var reqList = [].concat(activeQ.slice(), pendingQ.slice());
			var request;

			pendingQ = [];
			activeQ  = [];

			while (request = reqList.shift()) {
				request.cancel(reason);
			}
			this._next();
		};

		this.submit = function (request, async) {
			// summary:
			//		Submit a new load request for execution.
			// request: LoadRequest
			//		Instance of LoadRequest
			// async: Boolean?
			//		If true the request will be executed immediately otherwise
			//		the request may be queue depending on the current loading
			//		state.
			// tag:
			//		public
			if (request instanceof LoadRequest) {
				// Finalize the load request
				request.async  = async;
				request.parent = this;
				request.store  = loader.store;

				if (!loading || async) {
					this._next(request);
				} else {
					pendingQ.push(request);
				}
				return request.defer;
			}
		};

		//====================================================================

		if (typeof loader._getData != "function" || typeof loader._storeData != "function") {
			throw new StoreError("TypeError", "constructor", MSG_C_MISSING_METHOD, "_getData or _storeData");
		}

		lib.defProp(this, "loading", {
			get: function () { return loading; },
			enumerable: true
		});

		// Catch LoadRequest events.
		this.addEventListener("cancel, error, success", function (event) {
			if (event.target instanceof LoadRequest) {
				var request = event.target;
				switch (event.type) {
					case "cancel":
					case "success":
						event.stopPropagation();
						break;
				}
				removeFromQueue(request);
				this._next();
			}
		});

		lib.protect(this);
	} /* end LoadManager() */

	LoadManager.prototype = new EventTarget();
	LoadManager.prototype.constructor = LoadManager;

	return LoadManager;
});
