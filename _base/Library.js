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

define(["../error/createError!../error/StoreErrors.json"], function (createError) {

	var StoreError = createError( "indexedStore" );

	if (typeof Object.defineProperty != "function") {
		throw new Error("JavaScript 1.8.5. or higher required to run the Store module");
	}	

	var Library = {

		clone: function clone (object) {
			// html structured cloning algorithm. (no type map support)
			var memory = [];

			function inMemory(memory, object) {
				var obj;
				memory.some( function(entry) {
					if (entry.iObj === object) {
						obj = entry.oObj;
						return true;
					}
				});
				return obj;
			}

			function cloneObj( object, memory ) {
				if (object === null || !(object instanceof Object)) {
					return object;
				}
				if (obj = inMemory(memory,object)) {
					return obj;
				}
				var type = {}.toString.call(object);
				type = type.match(/\[\w+\s+(.*?)\]$/)[1];
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
						memory.push( {iObj:object, oObj:obj} );
						return obj;
					case "Date":
						return new Date( object.valueOf() );
					case "Regexp":
						var text = object.toString();
						var segm = text.match( /\/(.*?)\/([gim]*)$/);
						return new RegExp(segm[1], segm[2] );						
				}
				throw new StoreError("DataCloneError", "clone", "objects of type [%{0}] can not be cloned", type);
			}
			var clone = cloneObj( object, memory );
			return clone;
		},

		debug: function ( text )	{
			// summary:
			var msg = new Date() + (text ? " " + text : "");
			console.info( msg );
		},

		enumerate: function ( object, property, value ) {
			// summary:

			if (property instanceof Array) {
				property.forEach( function (prop) {
					this.enumerate( object, prop, value );
				}, this);
			}
			if (typeof object[property] == "function") {
//				Object.defineProperty( object, property, {value: object[property], enumerable:false});
			} else {
				Object.defineProperty( object, property, {enumerable:value});
			}
		},

		getProp: function (/*String*/ propPath,/*Object*/ object,/*Boolean*/ required ) {
			// summary:
			//		Return property value identified by a dot-separated property propPath
			// propPath:
			//		A dot (.) separated property name like: feature.attribute.type
			// object:
			//		JavaScript object
			// tag:
			//		Private
			var segm = propPath.split(".");
			var p, i = 0;

			while(object && (p = segm[i++])) {
				object = object[p];
			}
			return object;
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

		isObject: function (object) {
			return ({}.toString.call(object) == "[object Object]");
		},

		protect: function (object) {
			var props = Object.keys(object).filter( function(prop) {	return /^_/.test(prop);} );
			this.enumerate( object, props, false );
		},
		
		setProp: function (/*String*/ propPath,/*any*/ value, /*Object*/ object ) {
			// summary:
			//		Set the property value
			// propPath:
			//		A dot (.) separated property name like: feature.attribute.type
			// object:
			// value:
			// tag:
			//		Private
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
		},

		writable: function ( object, property, value ) {
			// summary:

			if (property instanceof Array) {
				property.forEach( function (prop) {
					this.enumerate( object, prop, value );
				}, this);
			}
			Object.defineProperty( object, property, {writable:value});
		}

	};

	return Library;
	
});
