//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["require",
		"dojo/_base/declare",
		"../_base/_Trigger",
		"../_base/FeatureList",
		"../_base/library",
		"../dom/event/Event",
		"../error/createError!../error/StoreErrors.json"
	], function (require, declare, _Trigger, FeatureList, lib, Event, createError) {
//	"use strict";

	// module:
	//		indexedStore/_base/_Loader
	// summary:
	//		Add a data loader to the store.
	// description:
	//		Add a data loader to the store. This module is a dojo plugin, the resource
	//		string following the exclamation mark identifies the loader to be installed.
	//		All plugin loaders must be located in the indexedStore/loader/ directory.
	// prerequisites:
	//		All loaders MUST, at a minimum, implement the following interface:
	//
	//			Loader interface {
	//				readonly	attribute DOMString		type;
	//				readonly	attribute boolean		loading;
	//				readonly	attribute FeatureList	features;
	//				void		cancel ();
	//				Promise		load (optional Directives directives);
	//			};
	//
	//			dictionary Directives {
	//			        ...
	//			};
	// example:
	//	|	required(["store/_base/_Loader!", ... ], function (Loader, ... ) {
	//	|						...
	//	|	}
	//
	//		The example above installs the default indexedStore/loader/Basic loader
	//		whereas the example below loads indexedStore/loader/Advanced.
	//
	//	|	required(["store/_base/_Loader!advanced", ... ], function (Loader, ... ) {
	//	|						...
	//	|	}

	var C_MSG_INVALID_ORDER   = "loader must be installed prior to any extension";
	var C_MSG_MULTI_INSTANCE  = "store already has a loader";
	var C_MSG_NO_LOADER_CLASS = "no plugin loader class specified, use '/_base/loader!<loaderClass>'";
	var C_MSG_NO_LOAD_METHOD  = "loader has no load method";

	var StoreError = createError("Loader");		// Create the StoreError type.
	var isString   = lib.isString;

	var cache = {};

	//	Define additional store directives.
	var storeDirectives = {
		// autoLoad: Boolean
		//		Indicates, when data or URL is specified, if the data should be loaded
		//		immediately (post store construction) or deferred until the user
		//		explicitly calls the store's load() method.
		autoLoad: true
	};

	var StoreLoader = declare(null, {

		constructor: function (kwArgs) {
			// summary:
			//		Create a loader instance. A loader MUST at a minimum have a
			//		load() method and optionally a submit() method both with a
			//		signature: <method>(optional Directives directives)
			// kwArgs: Object?
			//		A JavaScript key:value pairs object. Each key:value pair is
			//		a store directive or a directive to the additional modules
			//		and extensions mixed in.
			// tag:
			//		protected
			this.features = this.features || new FeatureList();
			if (!this.features.has("loader")) {
				if (this.features.has("hierarchy, CORS")) {
					throw new StoreError("Dependency", "constructor", C_MSG_INVALID_ORDER);
				}
				if (this.LoaderClass) {
					this.loader = new this.LoaderClass(this, kwArgs);
					if (typeof this.loader.load == "function") {
						// If the loader also has a submit method, extend the store
						// with that method. (REST style loaders only).
						var submit = this.loader.features.has("submit") || this.loader.submit;
						submit = isString(submit) ? this.loader[submit] : submit;
						if (submit && typeof submit == "function") {
							this.submit = function (directives) {
								return this.loader.submit(directives);
							};
							this.features.add("submit", true);
						}
					} else {
						throw new StoreError("DataError", "constructor", C_MSG_NO_LOAD_METHOD);
					}
				} else {
					throw new StoreError("DataError", "constructor", C_MSG_NO_LOADER_CLASS);
				}
			} else {
				throw new StoreError("Dependency", "constructor", C_MSG_MULTI_INSTANCE);
			}
			// Mix the additional store directives in with the store.
			this._directives.declare(storeDirectives, kwArgs);
			this.features.add("loader", this.loader);
		},

		postscript: function (kwArgs) {
			// summary:
			//		Called after all constructors have executed
			// kwArgs: Object?
			//		A JavaScript key:value pairs object. The kwArgs object is the same
			//		object passed to the constructor.
			// tag:
			//		protected, callback
			this.inherited(arguments);
			if (this.autoLoad) {
				this.state = "loading";
				this.load(kwArgs);
			}
		},

		load: function (directives) {
			// summary:
			//		Initiate a new load request. This function is the generic store
			//		load() method which serves all loader types that comply with the
			//		Loader interface.
			// directives: LoadDirectives?
			//		LoadDirectives, see (indexedStore/loader/Advanced for details).
			// returns: dojo/promise/Promise
			//		The promise returned has an extra property not found on on standard
			//		promises: response. The response property is a standard promise that
			//		is resolved with an object representing the response from the server.
			// tag:
			//		Public

			var suppress = this.suppressEvents;
			var store    = this;
			var event, promise;

			this.suppressEvents = true;

			// If the initial load request failed reset _storeReady to allow for
			// another attempt.
			if (this._storeReady.isRejected()) {
				this._storeReady = this._resetState();
			}
			store._trigger("loadStart");
			this._loading = promise = this.loader.load(directives);
			promise.always(function () {
				store._loading = store.loader.loading;
				store.suppressEvents = suppress;
				store._trigger("loadEnd");
			});
			promise.then(
				function () {
					setTimeout(function () {
						store._loading = store.loader.loading;
						store.dispatchEvent(new Event("load"));
						store._storeReady.resolve(store);
					}, 0);
					store._waiting = false;
				},
				function (err) {
					event = new Event("error", {error: err, bubbles: true});
					store._storeReady.reject(err);
					store.dispatchEvent(event);
				}
			);
			return promise;
		}
	});

	StoreLoader.load = function (resource, amdRequire, loaded) {
		// summary:
		//		Extend StoreLoader with a load() method allowing it to be used
		//		as a plugin. The resource string, that is, the string following
		//		the exclamation mark identifies the name of the loader.
		//		The loader requested must be located in the indexedStore/loader
		//		directory.
		// resource: String
		//		Name of the loader.
		// amdRequire: Function
		//		Global require function.
		// loaded: Function
		//		Callback.
		// tag:
		//		protected
		var type   = (resource || "Basic").toLowerCase();
		var ccType = type.replace(/^[a-z]/, function (c) { return c.toUpperCase(); });
		var ldrURI = "../loader/" + ccType;
		var loader = cache[ldrURI];

		if (!loader) {
			require([ldrURI], function (loader) {
				StoreLoader.extend({
					LoaderClass: loader
				});
				cache[ldrURI] = loader;
				loaded(StoreLoader);
			});
		} else {
			StoreLoader.prototype.LoaderClass = loader;
			loaded(StoreLoader);
		}
	};

	return StoreLoader;
});
