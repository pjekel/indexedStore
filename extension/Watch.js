//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/declare",
		"../_base/library",
		"../_base/Watcher",
		"../dom/event/EventTarget",
		"../error/createError!../error/StoreErrors.json"
	], function (declare, lib, Watcher, EventTarget, createError) {
	"use strict";

	// module:
	//		IndexStore/extension/Watch
	// summary:

	var StoreError = createError("Watch");			// Create the StoreError type.
	var isString   = lib.isString;
	var getProp    = lib.getProp;

	var Watch = declare(null, {
		constructor: function () {
			// If this is an eventable store register the 'set' event type creating
			// the 'onset' property.   Note: the Watch extension does not register
			// any listener with the store until there is something to watch for.

			if (this.eventable) {
				EventTarget.declareHandler(this, "set");
			}
			if (!this._clone) {
				console.warn("Watch Extension only works when object cloning is enabled");
			}

			// NOTE:
			//	Because the store watcher property is overwritten on transactional
			//	stores we reference the watcher property when calling watch() and
			//	unwatch() instead of directly mapping the methods.
			
			this.watcher = new Watcher(this);
			this.unwatch = function () { return this.watcher.unwatch.apply(this, arguments); };
			this.watch   = function () { return this.watcher.watch.apply(this, arguments); };

			this.features.add("watcher");
		}
	});	/* end Watch {} */
	return Watch;
});	/* end define() */
