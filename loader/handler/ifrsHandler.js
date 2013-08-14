//
// Copyright (c) 2012-2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/date/stamp",
		"dojo/json"
	   ], function (dateStamp, JSON) {
	"use strict";

	// module:
	//		cbtree/store/handlers/ifrsHandler
	// summary:
	//		Sample ItemFileReadStore data handler.
	// description:
	//		This handler takes an dojo/data/ItemFileReadStore (IFRS) formatted data
	//		response and converts it to a indexedStore format. If the response data
	//		is organized in a hierarchical structure the structure is flattened and
	//		all object references are resolved.
	//
	// NOTE:
	//		The following limitations apply:
	//			-	Only properties that match the list of children properties are
	//				flattened.
	//			-	Nested arrays are not supported.
	//
	// example:
	//	| require(["cbtree/store/Hierarchy",
	//	|		   "cbtree/store/handlers/ifrsHandler"
	//	|		  ], function (ObjectStore, ifrsHandler) {
	//	|
	//	|	 var store = new ObjectStore(
	//	|		{ url: "/some/data/location/myFile.json",
	//	|		  handleAs:"ifrs",
	//	|		  dataHandler: ifrsHandler
	//	|		});
	//	|
	//	|					 or
	//	|
	//	|	 var store = new ObjectStore(
	//	|		{ url: "/some/data/location/myFile.json",
	//	|		  handleAs:"ifrs",
	//	|		  dataHandler: {
	//	|			handler: ifrsHandler,
	//	|			options: {
	//	|				childProperty: ["children"]
	//	|						...
	//	|			}
	//	|		  }
	//	|		});
	//	| });
	var moduleName = "indexedStore/handler/ifrsHandler";

	function isObject(object) {
		// summary:
		//		Returns true if an object is a key:value pairs object.
		return (Object.prototype.toString.call(object) == "[object Object]");
	}

	function isFunction( object ) {
		// summary:
		//		Returns true if an object is function.
		return (Object.prototype.toString.call(object) == "[object Function]");
	}

	function ifrsHandler(options) {
		// summary:
		//		Closure for the actual data handler (e.g this.handler());
		// options: Object?
		//		JavaScript key:value pairs object.
		// tag:
		//		Public

		var self = this;

		this.name           = "ifrs";
		this.childProperty  = ["children"];		// Default children property name
		this.parentProperty = "parent";			// Default parent property name
		this.idProperty     = "id";				// Default id property name/
		this.referenceToId  = true;
		this.typeMap        = {};				// Custom data type map


		this.handler = function (response) {
			// summary:
			//		The data handler. The handler is registered with dojo/request/handlers
			//		The response data is converted into an array of JavaScript key:value
			//		pairs objects ready for the consumption by any cbtree/store.
			//		On successful completion of a dojo/request this method is called with
			//		the request response.
			// response: Object

			var parentProp = self.parentProperty;
			var childProps = self.childProperty;
			var identProp  = self.idProperty;
			var typeMap    = self.typeMap;
			var refToId    = self.referenceToId;

			var autoIndex = 1;
			var allItems  = [];
			var undefRef  = [];
			var index     = {};
			var ifrsData;
			var maxRef    = 0;

			function addParent(reference, parentId) {
				// summary:
				//		Add a parent id to the reference object
				// reference: String|Number
				// parentId: Id
				if (reference) {
					var child = getReference(reference, false);
					if (child) {
						var childId = child[identProp];
						var parents = child[parentProp];
						if (parents) {
							parents.push(parentId);
						} else {
							parents = [parentId];
						}
						child[parentProp] = parents;
						maxRef = Math.max(parents.length, maxRef);
					}
				}
			} /* end addParent() */

			function flattenHierarchy(parent) {
				// summary:
				//		Search the parent object for children properties and add any child
				//		that is not a reference as a separate object to the store.
				// parent: Object
				//		The parent object to be flattened.

				var parentId = parent[identProp];
				var property;

				// Make sure we have an id for the object.
				if (parentId) {
					if (typeof parentId == "number" && parentId > autoIndex) {
						autoIndex = Math.floor(parentId + 1);
					}
				} else {
					parentId = autoIndex++;
				}

				parent[identProp] = parentId;
				index[parentId]   = parent;

				allItems.push(parent);

				for (property in parent) {
					if (childProps.indexOf(property) != -1) {
						var children = parent[property];
						if (children && children instanceof Array) {
							children.forEach(function (child) {
								if (isObject(child) && !child._reference) {
									// Add the parent property to the child.
									child[parentProp] = parentId;
									flattenHierarchy(child);
								}
							});
						}
					}
				}
			}	/* end flattenHierarchy() */

			function getReference(reference, idOnly) {
				// summary:
				//		Locate and return the object associated with the reference.
				// reference: String|Number|Object
				//		If reference is an object the first store item that matches all
				//		of its property values is returned, otherwise reference is used
				//		as an identifier and the index is search to locate the item.
				// idOnly: Boolean?
				//		Indicates if only the reference id is to be returned.
				var item;

				if (isObject(reference)) {
					item = allItems.filter(
						function (item) {
							var prop;
							for (prop in reference) {
								if (item[prop] != reference[prop]) {
									return false;
								}
							}
							return true;
						}
					)[0];
				} else {
					// Keep track of any undefined references.
					if (!(item = index[reference])) {
						if (undefRef.indexOf(reference) == -1) {
							undefRef.push(reference);
						}
					}
				}
				return (item && idOnly) ? item[identProp] : item;
			}

			function mapType(type, value) {
				// summary:
				//		Instantiate a custom data type.
				// type: String
				//		Custom type name
				// value: any
				//		Value to be assigned to the custom data type.
				if (typeMap) {
					var mapObj = typeMap[type];
					if (mapObj) {
						if (isFunction(mapObj)) {
							return new mapObj(value);
						}
						// Test if it is a general format typeMap object like in:
						//	{type: Function, deserialize: Function}

						if (isObject(mapObj)) {
							var dszf = mapObj.deserialize;
							var ctor = mapObj.type;

							if (isFunction(dszf)) {
								return dszf(value);
							}
							if (isFunction(ctor)) {
								return new ctor(value);
							}
						}
					}
					throw new TypeError(moduleName+"::handler::mapType(): constructor missing for datatype: [" + type + "]");
				}
				throw new TypeError(moduleName + "::handler::mapType(): custom type detected but no mapping table available");
			} /* end customTypes() */

			function resolveRefAndType(object) {
				// summary:
				//		Resolve references and instantiate custom data types, if any.
				// object: Object
				var objectId = object[identProp];
				var property;

				for (property in object) {
					var values = object[property];
					if (values) {
						// Check if the values are considered children...
						if (parentProp && childProps.indexOf(property) != -1) {
							if (values instanceof Array) {
								values.forEach(function (child) {
									if (child._reference) {
										addParent(child._reference, objectId);
									}
								});
							}
							delete object[property];
							continue;
						}
						if (values instanceof Array) {
							values = values.map(function (value) {
								if (isObject(value)) {
									if (value._reference) {
										value = getReference(value._reference, refToId);
									} else if (value._type) {
										value = mapType(value._type, value._value);
									}
								}
								return value;
							});
							// remove any undefined references.
							object[property] = values.filter(function (item) { return !!item; });
						} else {
							if (isObject(values)) {
								if (values._reference) {
									object[property] = getReference(values._reference, refToId);
								} else if (values._type) {
									object[property] = mapType(values._type, values._value);
								}
							}
						}
					}
				} /* end for() */
			} /* end resolveRefAndType() */

			//======================================================================
			ifrsData = JSON.parse(response.text || response.data);

			if (ifrsData && ifrsData.items) {
				identProp = ifrsData.identifier || identProp;
				ifrsData.items.forEach(flattenHierarchy);
				allItems.forEach(resolveRefAndType);

				// If this is a single parent reference hierarchy convert the parent
				// property to a single value.
				if (maxRef == 1) {
					allItems.forEach(function (item) {
						item[parentProp] = item[parentProp] ? item[parentProp][0] : undefined;
					});
				}

				if (undefRef.length > 0) {
					console.warn("Undefined references: " + undefRef);
				}

			} else {
				// Don't try to be smart and guess the file format...
				throw new TypeError(moduleName + "::handler(): invalid IFRS file format");
			}
			return allItems;
		};

		this.set = function (property, value) {
			// summary:
			//		 Set a handler property value
			// property: String|Object
			//		Property name or a JavaScript key:value pairs object.
			// value: any?
			//		The property value.
			// tag:
			//		Public
			var key;
			if (property) {
				if (isObject(property)) {
					for (key in property) {
						this.set(key, property[key]);
					}
				} else {
					this[property] = value;
				}
			}
			this.childProperty = this.childProperty instanceof Array ? this.childProperty : [this.childProperty];
			// Set default Date type mapping if non was provided.
			this.typeMap = this.typeMap || {};
			if (!this.typeMap.Date) {
				this.typeMap.Date = {
					type: Date,
					deserialize: function (value) {
						return dateStamp.fromISOString(value);
					}
				};
			}
		};

		if (options) {
			self.set(options);
		}
	}	/* end ifrsHandler() */
	return ifrsHandler;
});
