//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../_base/library",
		"../error/createError!../error/StoreErrors.json",
		"./_Path"
	], function (lib, createError, Path) {
	"use strict";

	var StoreError = createError("PathList");		// Create the StoreError
	var defProp    = lib.defProp;

	function argsToPaths() {
		// summary:
		//		Convert the variable length arguments list into an array of Paths.
		// tag:
		//		Private
		var args  = Array.prototype.slice.call(arguments);
		var items = [];

		args.forEach(function (argument) {
			if (typeof argument === "string" || argument instanceof String) {
				items.push(new Path(argument));
			} else if (argument instanceof Path) {
				items.push(argument);
			} else if (argument instanceof Array) {
				items = items.concat(argsToPaths.apply(this, argument));
			} else if (argument instanceof PathList) {
				items = items.concat(argsToPaths.apply(this, Array.prototype.slice.call(argument)));
			} else {
				throw new StoreError("InvalidType", "argsToPaths");
			}
		});
		return items;
	}

	function intersect(pathsA, pathsB, inclusive, same) {
		// summary:
		//		Get all intersections of two sets of paths
		// pathsA: PathList
		//		PathList or array of Paths.
		// pathsB: PathList
		//		PathList or array of Paths.
		// inclusive: Boolean
		//		Indicates if the list of intersections should include the end-points.
		// same: Boolean
		//		Indicates if arguments pathsA and pathsA are the same set of paths.
		// returns:
		//		An array of segments.
		// tag:
		//		Private.
		var res = [];

		pathsA.forEach(function (pathA) {
			if (same) {
				pathsB.shift();
			}
			pathsB.forEach(function (pathB) {
				pathA.intersect(pathB, inclusive).forEach(function (segment) {
					if (res.indexOf(segment) == -1) {
						res.push(segment);
					}
				});
			});
		});
		return res;
	}

	function PathList() {
		// summary:
		//		The PathList is an array 'like' object whose content is a set of objects
		//		of type Path.
		// methods:
		//		contains  - Returns true is any path contains a given segment.
		//		intersect - Returns the intersections of two sets of paths.
		//		segments  - Get a list of unique segments across all paths.
		//		filter    - Array.prototype.filter
		//		forEach   - Array.prototype.forEach
		//		push      - Add new path(s) to the PathList content.
		//		some      - Array.prototype.forEach
		//
		this.contains = function (segment) {
			if (this !=  null && segment) {
				return this.some(function (path) {
					if (path.contains(segment)) {
						return true;
					}
				});
			}
			throw new StoreError("InvalidType", "contains");
		};

		this.intersect = function (paths, inclusive) {
			if (this != null) {
				var pathList, sameList = false, incl = inclusive;
				if (arguments.length) {
					if (typeof paths == "boolean") {
						incl = !!paths;	// paths was omitted...
					} else {
						pathList = argsToPaths(paths);
					}
				}
				if (!pathList) {
					pathList = Array.prototype.slice.call(this, 0);
					sameList = true;
				}
				return intersect(this, pathList, incl, sameList);
			}
			throw new StoreError("InvalidType", "intersect");
		};

		this.segments = function () {
			if (this != null) {
				var res = [];
				this.forEach(function (path) {
					path.segments().forEach(function (segment) {
						if (res.indexOf(segment) == -1) {
							res.push(segment);
						}
					});
				});
				return res;
			}
			throw new StoreError("InvalidType", "segments");
		};

		//==============================================================
		// Array style methods.

		this.filter = function (callback, thisArg) {
			if (this !=  null && typeof callback == "function") {
				var res = new PathList();
				var obj = Object.create(this);
				var idx, val;

				for (idx = 0; idx < obj.length; idx++) {
					if (obj[idx] !== undefined) {
						val = obj[idx];
						if (callback.call(thisArg, val, idx, obj)) {
							res.add(val);
						}
					}
				}
				return res;
			}
			throw new StoreError("InvalidType", "filter");
		};

		this.forEach = function (callback, thisArg) {
			if (this !=  null && typeof callback == "function") {
				var obj = Object.create(this);
				var idx = 0;

				for (idx = 0; idx < obj.length; idx++) {
					if (obj[idx] !== undefined) {
						callback.call(thisArg, obj[idx], idx, obj);
					}
				}
			} else {
				throw new StoreError("InvalidType", "forEach");
			}
		};

		this.push = function () {
			if (arguments.length > 0) {
				var paths = argsToPaths.apply(this, arguments);
				if (paths.length > 0) {
					paths.forEach(function (item, idx) {
						defProp(this, this.length + idx, {value: item, enumerable: true, writable: false});
						this.length++;
					}, this);
				}
			}
		};

		this.some = function (callback, thisArg) {
			if (this !=  null && typeof callback == "function") {
				var obj = Object.create(this);
				var idx = 0;

				for (idx = 0; idx < obj.length; idx++) {
					if (obj[idx] !== undefined) {
						if (callback.call(thisArg, obj[idx], idx, obj)) {
							return true;
						}
					}
				}
				return false;
			}
			throw new StoreError("InvalidType", "some");
		};

		defProp(this, "length",  { writable: true,  enumerable: false	});
		defProp(this, "filter",  { writable: false, enumerable: false	});
		defProp(this, "forEach", { writable: false, enumerable: false	});
		defProp(this, "some",    { writable: false, enumerable: false	});
		defProp(this, "push",    { writable: false, enumerable: false	});

		this.length = 0;
		this.push.apply(this, arguments);
	}
	return PathList;
});
