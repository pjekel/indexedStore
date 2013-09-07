//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../dom/event/Event",
		"../dom/event/EventTarget",
		"./_LoadDeferred"
	], function (Event, EventTarget, LoadDeferred) {
	"use strict";

	// module:
	//		indexedStore/loader/_LoadRequest
	// summary:
	// interface:
	//		[Constructor(DOMString type, LoadDirectives directives)]
	//		interface LoadRequest : EventTarget {
	//			readonly	attribute	LoadDirectives	directives;
	//			readonly	attribute	boolean			async;
	//			readonly	attribute	boolean			done;
	//			readonly	attribute	DOMString		type;
	//			readonly	attribute	Deferred		defer;
	//			readonly	attribute	integer			origin;
	//
	//			void	cancel((Error or DOMString) reason);
	//			void	error((Error or DOMString) error);
	//			void	success(Response response);
	//		};
	//
	//		dictionary LoadDirectives {
	//				...
	//		}
	var baseResp = Object.freeze({options: null, status: 0, text: ""});

	function getOrigin(directives) {
		// summary:
		//		Determine the resource origin
		// directives: LoadDirectives
		// returns: Number
		// tag:
		//		private
		var origin = 0;

		if (directives.url)        { origin = LoadRequest.URL; };
		if (directives.webStorage) { origin = LoadRequest.WEBSTORE; };
		if (directives.data)       { origin = LoadRequest.MEMORY; };

		return origin;
	}

	function LoadRequest(type, directives) {
		// summary:
		//		Create a new instance of LoadRequest
		// type: String
		//		Request type, typically a HTTP method name (GET, POST, PUT or DELETE)
		// directives: LoadDirectives
		// returns: LoadRequest
		// tag:
		//		public

		EventTarget.call(this);

		var defer, self = this;

		this.async      = false;
		this.defer      = null;
		this.directives = directives;
		this.done       = false;
		this.origin     = getOrigin(directives);
		this.store      = null;
		this.type       = type.toUpperCase();

		this.cancel = function (reason) {
			// summary:
			//		Cancel this load request
			// reason: Error|String
			//		Reason for cancellation.
			// tag:
			//		public
			this.defer.cancel(reason);
			this.canceled = true;
		};

		this.error = function (err) {
			// summary:
			// err: Error|String
			// tag:
			//		public
			this.dispatchEvent(new Event("error", {error: err, bubbles: true}));
			this.defer.response = err.response || baseResp;
			this.defer.reject(err);
		};

		this.success = function (response) {
			// summary:
			// response: Response
			// tag:
			//		public
			this.dispatchEvent(new Event("success", {bubbles: true}));
			this.defer.resolve(response);
		};

		defer = new LoadDeferred( function (reason) {
			self.dispatchEvent(new Event("cancel", {reason: reason, bubbles: true}));
			self.canceled = true;
		});

		defer.request = this;
		defer.active  = false;

		this.defer = defer;

	} /* end LoadRequest() */

	LoadRequest.MEMORY   = "memory";
	LoadRequest.URL      = "url";
	LoadRequest.WEBSTORE = "webstore";
	
	LoadRequest.prototype = new EventTarget();
	LoadRequest.prototype.constructor = LoadRequest;

	return LoadRequest;
});
