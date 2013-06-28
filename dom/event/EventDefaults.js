//
// Copyright (c) 2012-2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../../_base/library",
		"../../listener/Actions"
		], function (lib, Actions) {
	"use strict";

	// module:
	//		indexedStore/dom/event/EventDefaults
	// summary:
	//		Returns the global instance of Actions. If no	such instance exists one
	//		will be created. The global Actions instance is used by EventTargets
	//		when dispatching events.
	// example:
	//	|	require(["dojo/_base/declare",
	//	|	         "store/_base/_Store",
	//	|	         "store/_base/_Indexed",
	//	|          "store/extension/Eventable",
	//	|          "store/dom/event/EventDefaults"
	//	|         ], function (declare, _Store, _Indexed, Eventable, EventDefaults) {
	//	|	  var Store = declare(_Store, _Indexed, Eventable);
	//	|	  var store = new Store({keyPath:"name"});
	//	|	            ...
	//	|	  EventDefaults.after("new", function () {
	//	|	    console.log("After put action");
	//	|		});
	//	|	  EventDefaults.before("new", function () {
	//	|	    console.log("Before put action");
	//	|		});
	//	|	  store.on("new", function (evt) {
	//	|	    console.log("put event");
	//	|	  });
	//	|	            ...
	//	|	  store.put( {name:"Homer", lastname:"Simpson"} );
	//	|	});
	var DEFAULT_ACTIONS = "indexedStore.event.EventDefaults";

	var defaultActions = lib.getProp(DEFAULT_ACTIONS, window);
	if (!defaultActions) {
		defaultActions = new Actions();
		lib.setProp(DEFAULT_ACTIONS, defaultActions, window);
	}
	return defaultActions;
});
