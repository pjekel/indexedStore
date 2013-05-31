//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../error/createError!../error/StoreErrors.json", 
				"../shim/shims",
			 ], function (createError) {

	var StoreError = createError( "Library" );
	var _toString  = Object.prototype.toString;
  var undef;
  
	var Lib = {

		clone: function clone (object, strict) {
			// html structured cloning algorithm. (no type map support)
			var strict = strict != undef ? !!strict : true;
			var memory = [];

			function inMemory(memory, object) {
				var obj;
				memory.some( function(e) {
					if (e.inObj === object) {
						obj = e.outObj;
						return true;
					}
				});
				return obj;
			}

			function cloneObj( object, memory ) {
				if (object === null || !(object instanceof Object)) {
					return object;
				}
				if ( (obj = inMemory(memory,object)) ) {
					return obj;
				}
				var type = _toString.call(object).slice(8,-1);
				switch (type) {
					case "Object":
					case "Array":
						var val, key, obj = new object.constructor();
						for (key in object) {
							val = object[key];
							// try to minimize recursion
							if (val !== null && (val instanceof Object)) {
								obj[key] = cloneObj(val, memory);
							} else {
								obj[key] = val;
							}
						}
						memory.push( {inObj:object, outObj:obj} );
						return obj;
					case "Date":
						return new Date( object.valueOf() );
					case "RegExp":
						return new RegExp(object);
					case "Blob":
					case "File":
						return object.slice(0, object.size, object.type);
					default:
						if (!strict) {
							return object;
						}
						break;
				}
				throw new StoreError("DataCloneError", "clone", "objects of type [%{0}] can not be cloned", type);
			}
			var clone = cloneObj( object, memory );
			return clone;
		},

		copy: function (object) {
			// summary:
			//		create a shallow copy
			if (object === null || !(object instanceof Object)) {
				return object;
			}
			return this.mixin(object.constructor(), object);
		},

		debug: function ( text )	{
			// summary:
			var msg = new Date() + (text ? " " + text : "");
			console.info( msg );
		},

		defProp: function (object, prop, desc) {
			Object.defineProperty( object, prop, desc );
		},

		enumerate: function (/*Object*/ object,/*String|String[]*/ property,/*Boolean*/ value ) {
			// summary:
			// object:
			// property:
			// value:
			if (object && property) {
				if (property instanceof Array) {
					property.forEach( function (prop) {
						this.enumerate( object, prop, value );
					}, this);
				} else if (/,/.test(property)) {
					this.enumerate( object, property.split(/\s*,\s*/), value );
				} else if (typeof object[property] == "function") {
					Object.defineProperty( object, property, {value: object[property], enumerable:false});
				} else {
					this.defProp( object, property, {enumerable:!!value});
				}
			}
		},

		getProp: function (propPath, object) {
			// summary:
			//		Return property value identified by a dot-separated property path
			// propPath: String
			//		A dot (.) separated property name like: feature.attribute.type
			// object: (Object|Array)?
			//		JavaScript object
			// tag:
			//		Private
			object = object || window;
			if (Lib.isObject(object) || object instanceof Array || object === window) {
				var segm = propPath.split(".");
				var p, i = 0;

				while(object && (p = segm[i++])) {
					object = object[p];
				}
				return object;
			}
			throw new StoreError("TypeError", "getProp", "paramter 'object' must be an object or array");
		},

		isDirection: function ( direction ) {
			switch (direction) {
				case "next": case "nextunique":
				case "prev": case "prevunique":
					return true;
			}
			return false;
		},
	
		isEmpty: function (o) {
			// summary:
			//		Return true if object is empty otherwise false.
			for(var prop in o) {
				if(o.hasOwnProperty(prop)) {
					return false;
				}
			}
			return true;
		},

		isObject: function (obj) {
			// summary:
			//		Returns true if, and only if, an object is a JavaScript key:value
			//		pairs object
			return (obj && _toString.call(obj).slice(8,-1) == "Object");
		},

		isString: function(obj) {
			return (_toString.call(obj).slice(8,-1) == "String");
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
					if ((org = objAry.splice(from,1)[0]) && !val) {
						val = org;
					}
				}
				if (val && to > -1) {
					to = from > -1 ? (from < to ? --to : to) : to;
					objAry.splice(to, 0, val);	// Insert new or updated value.
				}
			} else {
				val = from > -1 ? objAry[from] : undef;
			}
			return val;
		},

		mixin: function (dest, objects) {
			var k, o, s, i=1, empty = {};
			var d = dest || {};

			while (o = arguments[i++]) {
				for (k in o) {
					s = o[k];
					if(!(k in d) || (d[k] !== s && (!(k in empty) || empty[k] !== s))){
						d[k] = s
					}
				}
			}
			return d;
		},

		protect: function (object) {
			var props = Object.keys(object).filter( function(prop) {	return /^_/.test(prop);} );
//			this.enumerate( object, props, false );
		},
		
		setProp: function (propPath,/*any*/ value, object) {
			// summary:
			//		Set the property value
			// propPath: String
			//		A dot (.) separated property name like: feature.attribute.type
			// object: (Object|Array)?
			// value:
			// tag:
			//		Private
			object = object || window;
			if (this.isObject(object) || object instanceof Array || object === window) {
				var segm = propPath.split(".");
				var prop = segm.pop();

				if (segm.length) {
					var p, i = 0;

					while(object && (p = segm[i++])) {
						object = (p in object) ? object[p] : object[p] = {};
					}
				}
				object[prop] = value;
				return value;
			}
			throw new StoreError("TypeError", "setProp", "parameter 'object' must be an object or array");
		},

		writable: function (/*Object*/ object,/*String|String[]*/ property,/*Boolean*/ value ) {
			// summary:
			// object:
			// property:
			// value:

			if (object && property) {
				if (property instanceof Array) {
					property.forEach( function (prop) {
						this.writable( object, prop, value );
					}, this);
				} else if (/,/.test(property)) {
					this.writable( object, property.split(/\s*,\s*/), value );
				} else {
					this.defProp( object, property, {writable:value});
				}
			}
		}

	};

	return Lib;
	
});
