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
		"../_base/Eventer",
		"../_base/library"
	], function (declare, Eventer, lib) {
	"use strict";

	// module:
	//		indexedStore/extension/Eventable
	// summary:
	//		Add event generation capabilities to the store.
	//		(See also indexedStore/_base/Eventer).

	var Eventable = declare(null, {
		constructor: function (kwArgs) {
			if (!this.features.has("eventable")) {
				this.features.add("eventable");
				this.eventable = true;

				this.eventer = new Eventer(this, "clear, close, delete, error, load, new, update");

				lib.defProp(this, "_emit", {
					configurable: false,
					enumerable: true,
					writable: true,
					value: this.eventer.emit
				});
				lib.writable("eventable", false);
			}
		}
	});
	return Eventable;
});