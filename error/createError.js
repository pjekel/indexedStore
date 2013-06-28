//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/request",
		"../_base/library"
	], function (request, lib) {
	"use strict";

	var mixin = lib.mixin;

	// module:
	//		indexedStore/error/createError
	// summary:
	//		The createError module returns a function which enables the definition
	//		of a custom Error type that uses predefined 'named' error messages.
	//		This module is implemented as a dojo plug-in to allow for loading error
	//		message definitions using external resource files.
	// example:
	//		The first example define the 'myError' type using a locally defined set
	//		of error messages whereas the second example load the error messages
	//		using an external, JSON encoded, resource file.
	//
	//	|	require(["module",
	//	|          "indexedStore/error/createError"
	//	|         ], function (module, createError) {
	//	|
	//	|	  var errDefs = [
	//	|	    {"NotFoundError":{text:"Object not found here", code:18}},
	//	|	                        ...
	//	|	  ];
	//	|
	//	|	  var myError = createError(module.id, errDefs);
	//	|
	//	|	  function someFunction (...) {
	//	|	    throw new myError("NotFoundError", "someFunction");
	//	|	  }
	//	|	});
	//
	//	|	require(["module",
	//	|          "indexedStore/error/createError!indexedStore/error/DOMErrors.json"
	//	|         ], function (module, createError) {
	//	|
	//	|	  var myError = createError(module.id);
	//	|
	//	|	  function someFunction (...) {
	//	|	    throw new myError("NotFoundError", "someFunction");
	//	|	  }
	//	|	});
	//

	var C_UNKNOWN = {text: "Undefined error", code: 0};

	// cacheURL: Object
	//		The list of resource URLs that have been loaded. Each resource file is
	//		loaded once.
	var cacheURL = {};

	// errorNames: Object
	//		A JavaScript key:value pairs object. Each key represents an error name
	//		and the value is an JavaScript object with at least a 'text' property:
	//
	//	|		{ "AbortError": { text: "Operation is aborted" } }
	//
	//		If the message value contains a 'type' property it, instead of the key,
	//		will be used as the name of the error. For example, the next definition:
	//
	//	|		{ "AbortError", {text: "Operation is aborted", type: "WentFishing" } }
	//
	//		when thrown as 'throw myError("AbortError");' will display a message
	//		like:
	//
	//				"WentFishing: Operation is aborted"
	//
	var errorNames = {};

	function addMessage(messages) {
		// summary:
		//		Add message definitions to the internal message table. Each message
		//		is defined by a key (e.g. the message type) and a value. The value
		//		is an object with the following properties: 'text' and optionally
		//		'code' and 'type'. If the type property is specified it is used
		//		as the alias for message type.
		//		Please note that the code property has been deprecated in the DOM
		//		specification and is provided for backward compatibility only.
		// messages: Object
		//		A single JavaScript key:value pairs object where each key:value pair
		//		defines a message. Alternatively an array of key:value pair objects
		//		where each object defines a message. The following is an example of
		//		a JSON encoded message object:
		//
		//		{"NotFoundError":{"text":"The object can not be found here","code":18}}
		// tag:
		//		private
		var type = Object.prototype.toString.call(messages);

		function validMsg(msgObj) {
			var key, value;
			for (key in msgObj) {
				value = msgObj[key];
				if (!value || !value.text || /\W/.test(key)) {
					return false;
				}
			}
			return true;
		}

		if (type == "[object Array]") {
			messages.forEach(addMessage);
		} else if (type == "[object Object]") {
			if (validMsg(messages)) {
				errorNames = mixin(errorNames, messages);
			}
		}
	}

	function getMessage(type, text) {
		// summary:
		//		Create and return a message object base of the specified type and
		//		optional message text.
		// type: String
		//		The message type with or without the 'Error' suffix, for example:
		//		'NotFoundError' or 'NotFound', both types are equivalent and are
		//		referred to as the long and abbreviated version. Please note that
		//		The message object returned will always have the long version as
		//		the value of the type property unless the pre-defined message has
		//		a 'type' property in which case the message type property is used
		//		instead.
		// text: String?
		//		Optional message text. If specified overrides the text associated
		//		with the message type.
		// returns:
		//		A JavaScript key:value pairs object with the properties	'type', 'code'
		//		and 'text'. For example:
		//			{type:"NotFoundError", text:"Object not found", code:18}
		// tag:
		//		private
		var abbr = (type || "").replace(/Error$/, "");
		var base = abbr + "Error";
		var msg  = {type: base, text: "", code: 0};

		if (abbr) {
			msg = mixin(msg, (errorNames[base] || errorNames[abbr] || C_UNKNOWN));
		}
		msg.text = text || msg.text;
		return msg;
	}

	function createError(module, errors) {
		// summary:
		//		Initialize and return the custom error type function/object.
		// module: String?
		//		Optional module name string. If specified it is used as the first
		//		part of the prefix applied to every message.
		// errors: Object?
		//		Optional, A JavaScript key:value pairs object where each key:value
		//		pair defines a message. Alternatively an array of key:value pair
		//		objects where each object defines a message.
		// returns: Function
		// tag:
		//		Public

		var prefix = module ? "::" : "";
		module = module || "";

		function StoreError(type, method, message) {
			// summary:
			//		Constructor, create a new instance of the custom error type.
			// type: String|Error
			//		If a string it identifies the message type, otherwise an instance
			//		or Error.
			// method: String?
			//		Method or function name used a the second part, module being the
			//		first, of the prefix applied to the message. The general format
			//		of any error messages looks like: <module><method><message>
			// message: String?
			//		Optional message text. If specified overrides the text assigned to
			//		the message type or, in case type is an Error, the Error message.
			// tag:
			//		private
			var path = module + (method ? (prefix + method + "()") : "");
			var prop, msgObj;

			// If 'type' is an instance of 'Error' copy its properties
			if (type instanceof Error) {
				for (prop in type) {
					if (type.hasOwnProperty(prop)) {
						this[prop] = type[prop];
					}
				}
				msgObj = {type: type.name, code: (type.code || 0), text: (message || type.message)};
			} else {
				msgObj = getMessage(type, message);
			}

			// In case additional arguments are specified (e.g. beyond message) see if
			// we need to inject them into the message. Placeholders for the arguments
			// are formatted as '%{n}' where n is a zero based argument index relative
			// to the 'message' argument.

			if (arguments.length > 2) {
				var args = Array.prototype.slice.call(arguments, 3);
				msgObj.text = msgObj.text.replace(/\%\{(\d+)\}/g, function (token, argIdx) {
					return (args[argIdx] != undefined ? args[argIdx] : token);
				});
			}

			this.message = (path.length ? path + ": " : "") + msgObj.text;
			this.code    = msgObj.code;		// deprecated but provided for backward compatibility.
			this.name    = msgObj.type;

			return this;
		}

		addMessage(errors || {});

		StoreError.prototype = new Error();
		StoreError.prototype.constructor = StoreError;

		return StoreError;
	}

	createError.load = function (resource, require, loaded) {
		// summary:
		//		dojo loader plugin portion. Called by the dojo loader whenever the
		//		module identifier, "indexedStore/error/createError", is followed by
		//		an exclamation mark (!) and a resource string.
		// resource: String
		//		The resource string is a list of one or more module ids separated by
		//		exclamation marks: '/path0/file0!/path1/file1!/path2/file2'
		// require: Function
		//		AMD require function.
		// loaded: Function
		//		dojo loader callback function. Called by this plug-in loader when all
		//		resources have been processed.
		// tag:
		//		public

		// Split the resource string into individual module ids.
		var resources = resource.split("!");
		var rscCount = resources.length;

		function resourceDone() {
			// Notify the dojo loader when all resources have been processed.
			if (--rscCount == 0) {
				loaded(createError);
			}
		}
		// Try loading each resource if we haven't done so already.
		resources.forEach(function (url) {
			url = require.toUrl(url);
			if (!cacheURL.hasOwnProperty(url)) {
				request(url, {handleAs: "json" }).then(
					function (response) {
						addMessage(response);
						resourceDone();
					},
					function (err) {
						// Known issue: http://bugs.dojotoolkit.org/ticket/16223
						console.log(err);
						resourceDone();
					}
				);
				cacheURL[url] = true;
			} else {
				resourceDone();
			}
		});
	};

	createError.getMessage = function (type) {
		// summary:
		// type: String
		// tag:
		//		public
		return errorNames[type];
	};

	return createError;
});
