define(["dojo/_base/declare",
				"../_base/Eventer",
				"../_base/Library",
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, Eventer, Lib, createError) {

	var StoreError = createError("Evantable");		// Create the StoreError type.

	var Eventable = declare( null, {

		constructor: function (kwArgs) {
			if (!this.features.has("eventable")) {
				this.features.add("eventable");
				this.eventable = true;
				
				this.eventer = new Eventer(this, "change, clear, close, delete, load, new");
				
				Lib.defProp( this, "emit", {
					configurable: false,
					enumerable: true, 
					value: this.eventer.emit
				});
				Lib.writable("eventable", false);
			}
		}
		
	});
	return Eventable;
});