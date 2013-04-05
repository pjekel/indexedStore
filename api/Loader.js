//
// Copyright (c) 2012-2013, Peter Jekel
// All rights reserved.
//
//	The Checkbox Tree (cbtree) is released under to following three licenses:
//
//	1 - BSD 2-Clause								(http://thejekels.com/cbtree/LICENSE)
//	2 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	3 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/declare"], function (declare) {
	"use strict";
	
	// module:
	//		store/api/Loader
	// summary:

	var Loader = declare( null, {
		// summary:

		//=========================================================================
		// Loader properties

		// autoLoad: Boolean
		//		Indicates, when a URL is specified, if the data should be loaded during
		//		store construction or deferred until the user explicitly calls the load
		//		method.
		autoLoad: true,

		// data: Array
		//		The array of all raw objects to be loaded in the memory store. This
		//		property is only used during store construction.
		//		(See also the 'dataHandler' and 'handleAs' properties).
		data: null,

		// dataHandler: Function|Object
		//		The data handler for the data/response. If dataHandler is an key:value
		//		pairs object, the object should looks like:
		//
		//			{ handler: Function|Object,
		//				options: Object?
		//			}
		//
		//		If the handler property is an object the object MUST have a property
		//		named 'handler' whose value is a function.	In this case the handler
		//		object provides	the scope/closure for	the handler function and the
		//		options, if any, are mixed into the scope. For example:
		//
		//			dataHandler: { handler: csvHandler,
		//										 options: { fieldNames:["col1", "col2"] }
		//									 }
		//		The handler function has the following signature:
		//
		//			handler( response )
		//
		//		The response argument is a JavaScript key:value pairs object with a
		//		"text" or "data" property.
		//
		//		(See cbtree/stores/handlers/csvHandler.js for an example handler).
		dataHandler: null,

		// filter: Object | Function
		//		Filter object or function applied to the store data prior to loading
		//		the store. The filter property is used to load a subset of objects
		//		in the store.
		filter: null,
		
		// handleAs: String
		//		If the handleAs property is omitted and the data property is specified
		//		no action is taken on the data. Whenever the url property is specified
		//		the handleAs property defaults to "json".
		handleAs: null,

		// progress: Boolean
		progress: false,
		
		// url: String
		//		The Universal Resource Location (URL) to retrieve the data from. If
		//		both	the data and url properties	are specified the	data property
		//		takes precendence. (See also 'handleAs')
		url: null,

		//=========================================================================
		// Loader methods

		load: function (/*LoadDirectives?*/ options) {
			// summary:
			//		Implements a simple store loader to load data. If the load request
			//		contains a dataset or URL and a load request is currently pending
			//		the new request is rejected.
			// options:
			//		optional /store/api/Store.LoadDirectives
			// returns:
			//		dojo/promise/Promise
			// tag:
			//		Public

		}

	});	/* end declare() */

	Loader.LoadDirectives = declare( null, {
		// summary:
		//		Directives passed to the load() method.
		// data: Array
		//		The array of all raw objects to be loaded in the memory store.
		//		(See also the 'handleAs' properties).
		// filter: Object | Function
		//		Filter object or function applied to the store data prior to loading
		//		the store. The filter property is used to load a subset of objects
		//		in the store.
		// handleAs: String
		//		If the handleAs property is omitted and the data property is specified
		//		no action is taken on the data. Whenever the url property is specified
		//		the handleAs property defaults to "json".
		// url: String?
		//		The Universal Resource Location (URL) to retrieve the store data from.
	});

	return Loader;

});
