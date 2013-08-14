//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define([], function () {
	"use strict";

	// module
	//		indexedStore/loader/_fixError
	// summary:
	//		Work-around for a dojo 1.8/1.9 XHR bug. Whenever a XHR requests fails
	//		the server response is still processed by the 'handleAs' data handler
	//		resulting in an incorrect error name (SyntaxError) and message.
	// Note:
	//		Bug filed as: http://bugs.dojotoolkit.org/ticket/16223

	function fixError(error) {
		if (error.response) {
			switch (error.response.status) {
				case 404:
					error.message = error.response.url.match(/[^?#]*/)[0];
					error.name    = "NotFoundError";
					break;
				case 405:
					error.message = error.response.url.match(/[^?#]*/)[0];
					error.name    = "InvalidAccessError";
			}
		}
		return error;
	}

	return fixError;
});
