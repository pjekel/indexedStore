define(["dojo/_base/declare",
				"../_base/Eventer",
				"../_base/Library"
			 ], function (declare, Eventer, Lib) {
	"use strict";
	
	// module:
	//		indexedStore/extension/Eventable
	// summary:
	//		Add event generation capabilities to the store.

	var Eventable = declare( null, {

		constructor: function (kwArgs) {
			if (!this.features.has("eventable")) {
				this.features.add("eventable");
				this.eventable = true;
				
				this.eventer = new Eventer(this, "change, clear, close, delete, load, new");
				
				Lib.defProp( this, "_emit", {
					configurable: false,
					enumerable: true, 
					value: this.eventer._emit
				});
				Lib.writable("eventable", false);
			}
		}
		
	});
	return Eventable;
});