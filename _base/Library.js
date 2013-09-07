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
	var encodeURI  = encodeURIComponent;

	var lib = {

		anyToArray: function (any) {
			// summary:
			//		Convert an argument to an array of arguments. If 'any' is a comma
			//		separated string the string is split.
			// any: any?
			// tag:
			//		public
			var res = [];
			if (any) {
				if (!(any instanceof Array)) {
					if (typeof any.split == "function") {
						res = any.split(/\s*,\s*/);
					} else if (any.length) {
						res = Array.prototype.slice.call(any);
					} else {
						res = [any];
					}
				} else {
					res = any.slice();
				}
			}
			return res;
		},

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
			var dest = Object.create(typeof obj === 'function' ? obj.prototype : obj || Object.prototype);
			return props ? lib.mixin(dest, props) : dest;
		},

		enumerate: function (object, property, value) {
			// summary:
			// object: Object
			// property: String|String[]
			// value: Boolean
			if (object && property) {
				var props = lib.anyToArray(property);
				props.forEach(function (prop) {
					var desc = Object.getOwnPropertyDescriptor(object, prop);
					desc.enumerable = !!value;
					Object.defineProperty(object, prop, desc);
				});
			}
		},

		filterOwn: function (base /* *[,obj] */) {
			// summary:
			//		Extract any key:value pair from obj whose key is present in base.
			// base: Object
			//		A JavaScript key:value pairs object providing the 'own' properties
			//		and associated default values.
			// obj: Object?
			//		A JavaScript key:value pairs objects. Each key:value pair overwrites
			//		the matching key:value in base. Keys in obj not present in base are
			//		ignored.
			// returns: Object
			// tag:
			//		public
			var idx, key, keys, obj, ownProp = {};
			if (base) {
				keys = Object.keys(base);	// Get own properties
				for (idx = 1; idx < arguments.length; idx++) {
					obj = arguments[idx];
					if (obj) {
						keys.forEach(function (key) {
							if (obj.hasOwnProperty(key)) {
								ownProp[key] = obj[key];
							}
						});
					}
				}
				// Normalize values.
				for (key in ownProp) {
					if (typeof base[key] == "boolean") {
						ownProp[key] = !!ownProp[key];
					} else if (typeof base[key] == "number") {
						ownProp[key] = Number(ownProp[key]) || 0;
					}
				}
			}
			return ownProp;
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

		getProp: function (propPath, object, defVal) {
			// summary:
			//		Return property value identified by a dot-separated property
			//		path
			// propPath: String
			//		A dot (.) separated property name like: feature.attribute.type
			// object: (Object|Array)?
			//		JavaScript object
			// defVal: any?
			//		Default value. If the requested property does not exists or
			//		returns undefined, the default value is returned.
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
				return obj !== undefined ? obj : defVal;
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

		keyToPath: function (key, encode) {
			// summary:
			// key:
			// encode: Boolean?
			// tag:
			//		private
			var path = (key || ""), comp;
			if (key) {
				if (key instanceof Array) {
					path = key.join("/");
				} else {
					path = key.toString();
				}
				// Strip leading and trailing forward slashes and encode the individual
				// path components if requested.
				path = path.replace(/^\s*\/|\/\s*$/g, "").trim();
				if (path && encode) {
					comp = path.split("/").map(encodeURI);
					path = comp.join("/");
				}
			}
			return path;
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
			var i, emp = {}, key, obj, val;
			var dst = dest || {};

			for (i = 1; i < arguments.length; i++) {
				obj = arguments[i] || {};
				for (key in obj) {
					val = obj[key];
					if (!(key in dst) || (dst[key] !== val && (!(key in emp) || emp[key] !== val))) {
						dst[key] = val;
					}
				}
			}
			return dst;
		},

		mixinOwn: function (target, base /* *[,obj] */) {
			// summary:
			//		Mix a set of base (properties) into the target and initialize
			//		them with the values found in the obj arguments. Any key in obj's
			//		that has no matching key in base is ignored.
			// target: Object
			// base: Object
			//		A JavaScript key:value pairs object providing the default properties
			//		to be added to the target object.
			// values: Object
			//		A JavaScript key:value pairs object. Each key:value pair overwrites
			//		the matching key:value in base. Keys in values not present in
			//		base are ignored.
			// tag:
			//		public
			var args = Array.prototype.slice.call(arguments, 1);
			var own  = lib.filterOwn.apply(null, args);
			return lib.mixin(target, base, own);
		},

		objectToURIQuery: function (query) {
			// summary:
			// query:
			// tag:
			//		private
			var assign, args = [], empty = {}, key, value;
			if (lib.isObject(query)) {
				for (key in query) {
					if (!empty.hasOwnProperty(key)) {
						assign = encodeURI(key) + "=";
						value  = query[key];
						if (value instanceof Array) {
							value.forEach(function (aryVal) {
								args.push(assign + encodeURI(aryVal));
							});
						} else {
							if (value instanceof RegExp) {
								value = value.toString();
							}
							args.push(assign + (encodeURI(value) || ""));
						}
					}
				}
			}
			return args.join("&");
		},

		protect: function (any) {
			// summary:
			// any: Object
			// tag:
			//		Public
			var props = Object.keys(any).filter(function (prop) { return (/^_/).test(prop); });
			this.enumerate(any, props, false);
		},

		readOnly: function (obj, property, value) {
			// summary:
			// obj: Object
			// property: String|String[]
			// value: Boolean?
			// tag:
			//		Public
			if (obj && property) {
				var write = value != null ? !value : false;
				var props = lib.anyToArray(property);
				props.forEach(function (prop) {
					var desc = Object.getOwnPropertyDescriptor(obj, prop);
					if (desc) {
						if (!write && (desc.get || desc.set)) {
							delete desc.set;
						} else {
							desc.writable = write;
						}
						Object.defineProperty(obj, prop, desc);
					}
				});
			}
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
					obj = (key in obj) ? obj[key] : (obj[key] = {});
					key = segm[i++];
				}
				obj[prop] = value;
				return value;
			}
			throw new TypeError("parameter 'obj' must be an obj or array");
		}
	};	/* end lib */
	return lib;
});
