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
		"../_base/library",
		"../dom/event/Event",
		"../error/createError!../error/StoreErrors.json"
	], function (require, declare, lib, Event, createError) {
//	"use strict";

	// module:
	//		indexedStore/_base/_Loader
	// summary:
	//		Add a data loader to the store.
	// description:
	//		Add a data loader to the store. This module can be invoked as any other
	//		AMD module or as a dojo plugin. Unless invoked as a plugin it will load
	//		the basic store loader (indexedStore/loader/Basic). When invoked as a
	//		plugin the resource string following the exclamation mark will identify
	//		the store loader to be installed. All plugin loaders must be located in
	//		the indexedStore/loader directory.
	// prerequisites:
	//		All loaders MUST comply with the following interface:
	//
	//			Loader interface {
	//				readonly	attribute String		type;
	//				readonly	attribute Boolean		loading;
	//				readonly	attribute FeatureList	features;
	//				void		cancel ();
	//				Directives	directives ();
	//				Promise		load (optional Directives directives);
	//				Promise		submit (optional Directives directives);
	//			};
	//
	//		Directives is a JavaScript key:value pairs object.
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

	var StoreError = createError("Loader");		// Create the StoreError type.
	var cache = {};

	//	Define additional store directives.
	var storeDirectives = {
		// autoLoad: Boolean
		//		Indicates, when data or URL is specified, if the data should be loaded
		//		immediately (post store construction) or deferred until the user
		//		explicitly calls the store's load() method.
		autoLoad: true
	};

	var StoreLoader = declare([], {

		constructor: function (kwArgs) {
			// summary:
			//		Create a loader instance.
			// kwArgs: Object?
			//		A JavaScript key:value pairs object. Each key:value pair is
			//		a store directive or a directive to the additional modules
			//		and extensions mixed in.
			// tag:
			//		protected
			if (!this.features.has("loader")) {
				if (this.features.has("hierarchy, CORS")) {
					throw new StoreError("Dependency", "constructor", C_MSG_INVALID_ORDER);
				}
				if (this.LoaderClass) {
					// Mix the additional store directives in with the store.
					this._directives.declare(storeDirectives, kwArgs);
					// Create an instance of the loader and test if the loader also
					// has a submit method (e.g. REST style loaders).
					this.loader = new this.LoaderClass(this, kwArgs);
					if (typeof this.loader.submit == "function") {
						this.submit = function (kwArgs) {
							return this.loader.submit(kwArgs);
						};
					}
					this.features.add("loader", this.loader);
				} else {
					throw new StoreError("DataError", "constructor", C_MSG_NO_LOADER_CLASS);
				}
			} else {
				throw new StoreError("Dependency", "constructor", C_MSG_MULTI_INSTANCE);
			}
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
				this._waiting    = this._storeReady.promise;
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
				StoreLoader.prototype.LoaderClass = loader;
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
