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
		"../dom/event/EventTarget"
	], function (declare, lib, EventTarget) {
	"use strict";

	// module:
	//		indexedStore/extension/Eventable
	// summary:
	//		Add event generation capabilities to the store.
	//		(See also indexedStore/_base/Eventer).

	var storeEvents = ["clear", "close", "delete", "load", "new", "update"];
	var Eventable = declare(null, {
		constructor: function () {
			if (!this.features.has("eventable")) {
				EventTarget.declareHandler(this, storeEvents);
				this.features.add("eventable");

				lib.defProp(this, "eventable", {value: true, writable: false, enumerable: true});
			}
		}
	});
	return Eventable;
});