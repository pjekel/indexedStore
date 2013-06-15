//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/declare",
				"../_base/Eventer",
				"../_base/Library",
				"../_base/Watcher",
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, Eventer, Lib, Watcher, createError) {
	"use strict";
	
	// module:
	//		IndexStore/extension/Watch
	// summary:

	var StoreError = createError( "Watch" );			// Create the StoreError type.
	var isString   = Lib.isString;
	var getProp    = Lib.getProp;
	
	var Watch = declare( null, {

		//=========================================================================
		// constructor
		
		constructor: function (kwArgs) {
			
			// If this is an eventable store regsiter the 'set' event type creating
			// the 'onSet' method.  Note: the Watch extension does not register any
			// listener with the store until there is something to watch for.

			if (this.eventable && this.eventer instanceof Eventer) {
				this.eventer.addHandler("set");
			}
			if (!this._clone) {
				console.warn("Watch Extension only works when object cloning is enabled");
			}

			this.watcher = new Watcher(this);
			this.unwatch = this.watcher.unwatch;
			this.watch   = this.watcher.watch;

			this.features.add("watcher");

		}

	});	/* end Watch {} */
	
	return Watch;

});	/* end define() */
