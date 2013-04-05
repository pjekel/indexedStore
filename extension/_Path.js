define (["../error/createError!../error/StoreErrors.json"], function (createError) {
	"use strict";

	var defineProperty = Object.defineProperty;
	var StoreError = createError("Path");		// Create the StoreError 

	function intersect(pathA, pathB, inclusive) {
		var a = pathA.segments();
		var b = pathB.segments();
		var i = 0, j = 0, r = [];

		if (a.length && b.length) {
			if (inclusive == false) {
				if (a[0] === b[0]) {
					a.shift();
					b.shift();
				}
				if (a[a.length-1] === b[b.length-1]) {
					a.pop();
					b.pop();
				}
			}
			r = a.filter( function( segm ) { 
				return (b.indexOf(segm) != -1);
			} );
		}
		return r;
	};

	function Path ( path, separator ) {
		var separator = separator || "/";
		var segments  = path.split(separator);
		var path      = path;
		
		this.contains = function ( segment ) {
			if (segment) {
				if (typeof segment.test == "function") {
					return segment.test(path);
				}
				return (segments.indexOf(segment) != -1);
			}
			return false;
		};

		this.intersect = function (path, inclusive) {
			if (path instanceof Path) {
				return intersect( this, path, inclusive);
			} else {
				throw new StoreError("InvalidType", "intersect");
			}
		};

		this.segments = function () {
			return segments.slice(0);
		};

		defineProperty( this, "string", { value: path, enumerable: true, writable: false	});
		defineProperty( this, "length", { value: segments.length, enumerable: false});
	}

	return Path;
	
});
