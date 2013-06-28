//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../shim/shims"], function () {
	"use strict";

	// module:
	//		indexedStore/_base/library
	// summary:
	//		The Library module provides a set of common functions shared by many
	//		other modules.

	var _toString  = Object.prototype.toString;

	var lib = {

		clone: function clone(object, strict) {
			// summary:
			//		html5 structured cloning algorithm. (no type map support)
			// object: any
			//		Object to clone.
			// strict: Boolean?
			// tag:
			//		Public

			function cloneObj(o, m, s) {
				// summary:
				//		Clone an object
				// o: any
				// m: Object[]
				// s: Boolean?
				// returns: any
				// tag:
				//		protected
				if (o === null || !(o instanceof Object)) {
					return o;
				}
				// Check if we already have a copy
				var i, l = m.length;
				for (i = 0; i < l; i++) {
					if (m[i].o === o) {
						return m[i].c;
					}
				}
				var t = lib.getClass(o);
				switch (t) {
					case "Object":
					case "Array":
						var k, c = new o.constructor();
						for (k in o) {
							c[k] = cloneObj(o[k], m, s);
						}
						m.push({o: o, c: c});
						return c;
					case "Date":
						return new Date(o.valueOf());
					case "RegExp":
						return new RegExp(o);
					case "Blob":
					case "File":
						return o.slice(0, o.size, o.t);
					default:
						s = s !== undefined ? !!s : true;
						if (!s) {
							return o;
						}
				}
				var e = new Error("objects of type " + t + " can not be cloned");
				e.name = "DataCloneError";
				throw e;
			}
			var memory = [];
			return cloneObj(object, memory, strict);
		},

		debug: function (text) {
			// summary:
			// text: String
			// tag:
			//		Public
			var msg = new Date() + (text ? " " + text : "");
			console.info(msg);
		},

		defProp: function (object, prop, desc) {
			Object.defineProperty(object, prop, desc);
		},

		delegate: function (obj, props) {
			// summary:
			// obj: Object
			// props: Object?
			// tag:
			//		public
			return props ? lib.mixin(Object.create(obj), props) : Object.create(props);
		},

		enumerate: function (object, property, value) {
			// summary:
			// object: Object
			// property: String|String[]
			// value: Boolean
			if (object && property) {
				if (property instanceof Array) {
					property.forEach(function (prop) {
						this.enumerate(object, prop, value);
					}, this);
				} else if (/,/.test(property)) {
					this.enumerate(object, property.split(/\s*,\s*/), value);
				} else if (typeof object[property] == "function") {
					Object.defineProperty(object, property, {value: object[property], enumerable: false});
				} else {
					Object.defineProperty(object, property, {enumerable: !!value});
				}
			}
		},

		getClass: function (obj) {
			// summary:
			//		Get the [[Class]] property of  an object.
			// obj: Object
			// returns: String
			//		the [[Class]] property of  an object.
			// tag:
			//		public
			return _toString.call(obj).slice(8, -1);
		},

		getProp: function (propPath, object) {
			// summary:
			//		Return property value identified by a dot-separated property path
			// propPath: String
			//		A dot (.) separated property name like: feature.attribute.type
			// object: (Object|Array)?
			//		JavaScript object
			// tag:
			//		public
			var key, segm, i = 0, obj = object || window;
			if (lib.isObject(obj) || obj instanceof Array || obj === window) {
				segm = propPath.split(".");
				key  = segm[i++];

				while (obj && key) {
					obj = obj[key];
					key = segm[i++];
				}
				return obj;
			}
			throw new TypeError("parameter 'obj' must be an obj or array");
		},

		isDirection: function (direction) {
			// summary:
			// direction: String
			// tag:
			//		Public
			var d = direction;
			return (d == "next" || d == "prev" || d == "nextunique" || d == "prevunique");
		},

		isEmpty: function (o) {
			// summary:
			//		Return true if object is empty, that is, has no enumerable
			//		properties of its own, otherwise false.
			// o: Object
			// tag:
			//		Public
			return (o ? !Object.keys(o).length : true);
		},

		isFunction: function (obj) {
			// summary:
			// tag:
			//		Public
			return (obj && _toString.call(obj).slice(8, -1) == "Function");
		},

		isObject: function (obj) {
			// summary:
			//		Returns true if, and only if, an object is a JavaScript key:value
			//		pairs object
			// tag:
			//		Public
			return (obj && _toString.call(obj).slice(8, -1) == "Object");
		},

		isString: function (obj) {
			// tag:
			//		Public
			return (obj !== undefined && _toString.call(obj).slice(8, -1) == "String");
		},

		move: function (objAry, from, to, value) {
			// summary:
			//		Insert, relocate or delete an value in an array of objects
			// objAry:
			//		Array of objects
			// from: Number
			//		Array index number of the value to be moved. If 'from' equals -1
			//		no value in the array is moved.
			// to: Number
			//		New array index number of the value. If 'to' equals -1 no value
			//		is inserted into the array.
			// value: any?
			//		If specified, the value to be inserted into the array, otherwise
			//		the value at the 'from' location is used.
			// tag:
			//		Public
			var org, val = value;
			if (val || from != to) {
				if (from > -1) {
					org = objAry.splice(from, 1)[0];
					if (org && !val) {
						val = org;
					}
				}
				if (val && to > -1) {
					to = from > -1 ? (from < to ? --to : to) : to;
					objAry.splice(to, 0, val);	// Insert new or updated value.
				}
			} else {
				val = from > -1 ? objAry[from] : undefined;
			}
			return val;
		},

		mixin: function (dest /* *[,obj] */) {
			// summary:
			// dest: Object?
			// obj: Object*
			//		A list of comma separated objects
			// tag:
			//		Public
			var i = 1, emp = {};
			var obj = arguments[i++];
			var dst = dest || {};

			while (obj) {
				var key, val;
				for (key in obj) {
					val = obj[key];
					if (!(key in dst) || (dst[key] !== val && (!(key in emp) || emp[key] !== val))) {
						dst[key] = val;
					}
				}
				obj = arguments[i++];
			}
			return dst;
		},

		protect: function (object) {
			// summary:
			// object: Object
			// tag:
			//		Public
			var props = Object.keys(object).filter(function (prop) { return (/^_/).test(prop); });
//			this.enumerate(object, props, false);
		},

		setProp: function (propPath, value, object) {
			// summary:
			//		Set the property value
			// propPath: String
			//		A dot (.) separated property name like: feature.attribute.type
			// value: any
			// object: (Object|Array)?
			// returns: any
			//		The new property value.
			// tag:
			//		Private
			var i = 0, obj = object || window;
			if (lib.isObject(obj) || obj instanceof Array || obj === window) {
				var segm = propPath.split(".");
				var prop = segm.pop();
				var key  = segm[i++];

				while (obj && key) {
					obj = (key in obj) ? obj[key] : obj[key] = {};
					key = segm[i++];
				}
				obj[prop] = value;
				return value;
			}
			throw new TypeError("parameter 'obj' must be an obj or array");
		},

		writable: function (object, property, value) {
			// summary:
			// object: Object
			// property: String|String[]
			// value: Boolean
			// tag:
			//		Public
			if (object && property) {
				if (property instanceof Array) {
					property.forEach(function (prop) {
						this.writable(object, prop, value);
					}, this);
				} else if (/,/.test(property)) {
					this.writable(object, property.split(/\s*,\s*/), value);
				} else {
					this.defProp(object, property, {writable: value});
				}
			}
		}
	};	/* end lib */
	return lib;
});
