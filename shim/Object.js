define( [], function () {

	// module:
	//		indexedStore/shim/Object
	// summary:
	// 		This module contains a subset of ES5 shim/sham. The es5-shim project
	//		can be found @ https://github.com/kriskowal/es5-shim

	// ES-5 15.3.4.5
	// http://es5.github.com/#x15.3.4.5

	function Empty() {}

	if (!Function.prototype.bind) {
		Function.prototype.bind = function bind(that) { // .length is 1
			// 1. Let Target be the this value.
			var target = this;
			// 2. If IsCallable(Target) is false, throw a TypeError exception.
			if (typeof target != "function") {
				throw new TypeError("Function.prototype.bind called on incompatible " + target);
			}
			// 3. Let A be a new (possibly empty) internal list of all of the
			//   argument values provided after thisArg (arg1, arg2 etc), in order.
			// XXX slicedArgs will stand in for "A" if used
			var args = _Array_slice_.call(arguments, 1); // for normal call
			// 4. Let F be a new native ECMAScript object.
			// 11. Set the [[Prototype]] internal property of F to the standard
			//   built-in Function prototype object as specified in 15.3.3.1.
			// 12. Set the [[Call]] internal property of F as described in
			//   15.3.4.5.1.
			// 13. Set the [[Construct]] internal property of F as described in
			//   15.3.4.5.2.
			// 14. Set the [[HasInstance]] internal property of F as described in
			//   15.3.4.5.3.
			var bound = function () {

				if (this instanceof bound) {
					// 15.3.4.5.2 [[Construct]]
					// When the [[Construct]] internal method of a function object,
					// F that was created using the bind function is called with a
					// list of arguments ExtraArgs, the following steps are taken:
					// 1. Let target be the value of F's [[TargetFunction]]
					//   internal property.
					// 2. If target has no [[Construct]] internal method, a
					//   TypeError exception is thrown.
					// 3. Let boundArgs be the value of F's [[BoundArgs]] internal
					//   property.
					// 4. Let args be a new list containing the same values as the
					//   list boundArgs in the same order followed by the same
					//   values as the list ExtraArgs in the same order.
					// 5. Return the result of calling the [[Construct]] internal
					//   method of target providing args as the arguments.

					var result = target.apply(
						this,
						args.concat(_Array_slice_.call(arguments))
					);
					if (Object(result) === result) {
						return result;
					}
					return this;

				} else {
					// 15.3.4.5.1 [[Call]]
					// When the [[Call]] internal method of a function object, F,
					// which was created using the bind function is called with a
					// this value and a list of arguments ExtraArgs, the following
					// steps are taken:
					// 1. Let boundArgs be the value of F's [[BoundArgs]] internal
					//   property.
					// 2. Let boundThis be the value of F's [[BoundThis]] internal
					//   property.
					// 3. Let target be the value of F's [[TargetFunction]] internal
					//   property.
					// 4. Let args be a new list containing the same values as the
					//   list boundArgs in the same order followed by the same
					//   values as the list ExtraArgs in the same order.
					// 5. Return the result of calling the [[Call]] internal method
					//   of target providing boundThis as the this value and
					//   providing args as the arguments.

					// equiv: target.call(this, ...boundArgs, ...args)
					return target.apply(
						that,
						args.concat(_Array_slice_.call(arguments))
					);

				}

			};
			if(target.prototype) {
				Empty.prototype = target.prototype;
				bound.prototype = new Empty();
				// Clean up dangling references.
				Empty.prototype = null;
			}
			// XXX bound.length is never writable, so don't even try
			//
			// 15. If the [[Class]] internal property of Target is "Function", then
			//     a. Let L be the length property of Target minus the length of A.
			//     b. Set the length own property of F to either 0 or L, whichever is
			//       larger.
			// 16. Else set the length own property of F to 0.
			// 17. Set the attributes of the length own property of F to the values
			//   specified in 15.3.5.1.

			// TODO
			// 18. Set the [[Extensible]] internal property of F to true.

			// TODO
			// 19. Let thrower be the [[ThrowTypeError]] function Object (13.2.3).
			// 20. Call the [[DefineOwnProperty]] internal method of F with
			//   arguments "caller", PropertyDescriptor {[[Get]]: thrower, [[Set]]:
			//   thrower, [[Enumerable]]: false, [[Configurable]]: false}, and
			//   false.
			// 21. Call the [[DefineOwnProperty]] internal method of F with
			//   arguments "arguments", PropertyDescriptor {[[Get]]: thrower,
			//   [[Set]]: thrower, [[Enumerable]]: false, [[Configurable]]: false},
			//   and false.

			// TODO
			// NOTE Function objects created using Function.prototype.bind do not
			// have a prototype property or the [[Code]], [[FormalParameters]], and
			// [[Scope]] internal properties.
			// XXX can't delete prototype in pure-js.

			// 22. Return F.
			return bound;
		};
	}

	// Shortcut to an often accessed properties, in order to avoid multiple
	// dereference that costs universally.
	// _Please note: Shortcuts are defined after `Function.prototype.bind` as we
	// us it in defining shortcuts.
	var call = Function.prototype.call;
	var prototypeOfArray = Array.prototype;
	var prototypeOfObject = Object.prototype;
	var _Array_slice_ = prototypeOfArray.slice;
	// Having a toString local variable name breaks in Opera so use _toString.
	var _toString = call.bind(prototypeOfObject.toString);
	var owns = call.bind(prototypeOfObject.hasOwnProperty);

	// If JS engine supports accessors creating shortcuts.
	var defineGetter;
	var defineSetter;
	var lookupGetter;
	var lookupSetter;
	var supportsAccessors;
	if ((supportsAccessors = owns(prototypeOfObject, "__defineGetter__"))) {
		defineGetter = call.bind(prototypeOfObject.__defineGetter__);
		defineSetter = call.bind(prototypeOfObject.__defineSetter__);
		lookupGetter = call.bind(prototypeOfObject.__lookupGetter__);
		lookupSetter = call.bind(prototypeOfObject.__lookupSetter__);
	}

	//
	// Object
	// ======
	//

	// ES5 15.2.3.2
	// http://es5.github.com/#x15.2.3.2
	if (!Object.getPrototypeOf) {
		// https://github.com/kriskowal/es5-shim/issues#issue/2
		// http://ejohn.org/blog/objectgetprototypeof/
		// recommended by fschaefer on github
		Object.getPrototypeOf = function getPrototypeOf(object) {
			return object.__proto__ || (
				object.constructor
					? object.constructor.prototype
					: prototypeOfObject
			);
		};
	}

	//ES5 15.2.3.3
	//http://es5.github.com/#x15.2.3.3

	function doesGetOwnPropertyDescriptorWork(object) {
		try {
			object.sentinel = 0;
			return Object.getOwnPropertyDescriptor(
					object,
					"sentinel"
			).value === 0;
		} catch (exception) {
			// returns falsy
		}
	}

	//check whether getOwnPropertyDescriptor works if it's given. Otherwise,
	//shim partially.
	if (Object.defineProperty) {
		var getOwnPropertyDescriptorWorksOnObject = 
			doesGetOwnPropertyDescriptorWork({});
		var getOwnPropertyDescriptorWorksOnDom = typeof document == "undefined" ||
		doesGetOwnPropertyDescriptorWork(document.createElement("div"));
		if (!getOwnPropertyDescriptorWorksOnDom || 
				!getOwnPropertyDescriptorWorksOnObject
		) {
			var getOwnPropertyDescriptorFallback = Object.getOwnPropertyDescriptor;
		}
	}

	if (!Object.getOwnPropertyDescriptor || getOwnPropertyDescriptorFallback) {
		var ERR_NON_OBJECT = "Object.getOwnPropertyDescriptor called on a non-object: ";

		Object.getOwnPropertyDescriptor = function getOwnPropertyDescriptor(object, property) {
			if ((typeof object != "object" && typeof object != "function") || object === null) {
				throw new TypeError(ERR_NON_OBJECT + object);
			}

			// make a valiant attempt to use the real getOwnPropertyDescriptor
			// for I8's DOM elements.
			if (getOwnPropertyDescriptorFallback) {
				try {
					return getOwnPropertyDescriptorFallback.call(Object, object, property);
				} catch (exception) {
					// try the shim if the real one doesn't work
				}
			}

			// If object does not owns property return undefined immediately.
			if (!owns(object, property)) {
				return;
			}

			// If object has a property then it's for sure both `enumerable` and
			// `configurable`.
			var descriptor =  { enumerable: true, configurable: true };

			// If JS engine supports accessor properties then property may be a
			// getter or setter.
			if (supportsAccessors) {
				// Unfortunately `__lookupGetter__` will return a getter even
				// if object has own non getter property along with a same named
				// inherited getter. To avoid misbehavior we temporary remove
				// `__proto__` so that `__lookupGetter__` will return getter only
				// if it's owned by an object.
				var prototype = object.__proto__;
				object.__proto__ = prototypeOfObject;

				var getter = lookupGetter(object, property);
				var setter = lookupSetter(object, property);

				// Once we have getter and setter we can put values back.
				object.__proto__ = prototype;

				if (getter || setter) {
					if (getter) {
						descriptor.get = getter;
					}
					if (setter) {
						descriptor.set = setter;
					}
					// If it was accessor property we're done and return here
					// in order to avoid adding `value` to the descriptor.
					return descriptor;
				}
			}

			// If we got this far we know that object has an own property that is
			// not an accessor so we set it as a value and return descriptor.
			descriptor.value = object[property];
			descriptor.writable = true;
			return descriptor;
		};
	}

	// ES5 15.2.3.4
	// http://es5.github.com/#x15.2.3.4
	if (!Object.getOwnPropertyNames) {
		Object.getOwnPropertyNames = function getOwnPropertyNames(object) {
			return Object.keys(object);
		};
	}


	// ES5 15.2.3.5
	// http://es5.github.com/#x15.2.3.5
	if (!Object.create) {

		// Contributed by Brandon Benvie, October, 2012
		var createEmpty;
		var supportsProto = Object.prototype.__proto__ === null;
		if (supportsProto || typeof document == 'undefined') {
			createEmpty = function () {
				return { "__proto__": null };
			};
		} else {
			// In old IE __proto__ can't be used to manually set `null`, nor does
			// any other method exist to make an object that inherits from nothing,
			// aside from Object.prototype itself. Instead, create a new global
			// object and *steal* its Object.prototype and strip it bare. This is
			// used as the prototype to create nullary objects.
			createEmpty = function () {
				var iframe = document.createElement('iframe');
				var parent = document.body || document.documentElement;
				iframe.style.display = 'none';
				parent.appendChild(iframe);
				iframe.src = 'javascript:';
				var empty = iframe.contentWindow.Object.prototype;
				parent.removeChild(iframe);
				iframe = null;
				delete empty.constructor;
				delete empty.hasOwnProperty;
				delete empty.propertyIsEnumerable;
				delete empty.isPrototypeOf;
				delete empty.toLocaleString;
				delete empty.toString;
				delete empty.valueOf;
				empty.__proto__ = null;

				function Empty() {}
				Empty.prototype = empty;
				// short-circuit future calls
				createEmpty = function () {
					return new Empty();
				};
				return new Empty();
			};
		}

		Object.create = function create(prototype, properties) {

			var object;
			function Type() {}  // An empty constructor.

			if (prototype === null) {
				object = createEmpty();
			} else {
				if (typeof prototype !== "object" && typeof prototype !== "function") {
					// In the native implementation `parent` can be `null`
					// OR *any* `instanceof Object`  (Object|Function|Array|RegExp|etc)
					// Use `typeof` tho, b/c in old IE, DOM elements are not `instanceof Object`
					// like they are in modern browsers. Using `Object.create` on DOM elements
					// is...err...probably inappropriate, but the native version allows for it.
					throw new TypeError("Object prototype may only be an Object or null"); // same msg as Chrome
				}
				Type.prototype = prototype;
				object = new Type();
				// IE has no built-in implementation of `Object.getPrototypeOf`
				// neither `__proto__`, but this manually setting `__proto__` will
				// guarantee that `Object.getPrototypeOf` will work as expected with
				// objects created using `Object.create`
				object.__proto__ = prototype;
			}

			if (properties !== void 0) {
				Object.defineProperties(object, properties);
			}

			return object;
		};
	}

	// ES5 15.2.3.6
	// http://es5.github.com/#x15.2.3.6

	// Patch for WebKit and IE8 standard mode
	// Designed by hax <hax.github.com>
	// related issue: https://github.com/kriskowal/es5-shim/issues#issue/5
	// IE8 Reference:
	//	 http://msdn.microsoft.com/en-us/library/dd282900.aspx
	//	 http://msdn.microsoft.com/en-us/library/dd229916.aspx
	// WebKit Bugs:
	//	 https://bugs.webkit.org/show_bug.cgi?id=36423

	function doesDefinePropertyWork(object) {
		try {
			Object.defineProperty(object, "sentinel", {});
			return "sentinel" in object;
		} catch (exception) {
			// returns falsy
		}
	}

	// check whether defineProperty works if it's given. Otherwise,
	// shim partially.
	if (Object.defineProperty) {
		var definePropertyWorksOnObject = doesDefinePropertyWork({});
		var definePropertyWorksOnDom = typeof document == "undefined" ||
			doesDefinePropertyWork(document.createElement("div"));
		if (!definePropertyWorksOnObject || !definePropertyWorksOnDom) {
			var definePropertyFallback = Object.defineProperty,
				definePropertiesFallback = Object.defineProperties;
		}
	}

	if (!Object.defineProperty || definePropertyFallback) {
		var ERR_NON_OBJECT_DESCRIPTOR = "Property description must be an object: ";
		var ERR_NON_OBJECT_TARGET = "Object.defineProperty called on non-object: "
		var ERR_ACCESSORS_NOT_SUPPORTED = "getters & setters can not be defined " +
											"on this javascript engine";

		Object.defineProperty = function defineProperty(object, property, descriptor) {
			if ((typeof object != "object" && typeof object != "function") || object === null) {
				throw new TypeError(ERR_NON_OBJECT_TARGET + object);
			}
			if ((typeof descriptor != "object" && typeof descriptor != "function") || descriptor === null) {
				throw new TypeError(ERR_NON_OBJECT_DESCRIPTOR + descriptor);
			}
			// make a valiant attempt to use the real defineProperty
			// for I8's DOM elements.
			if (definePropertyFallback) {
				try {
					return definePropertyFallback.call(Object, object, property, descriptor);
				} catch (exception) {
					// try the shim if the real one doesn't work
				}
			}

			// If it's a data property.
			if (owns(descriptor, "value")) {
				// fail silently if "writable", "enumerable", or "configurable"
				// are requested but not supported
				/*
				// alternate approach:
				if ( // can't implement these features; allow false but not true
					!(owns(descriptor, "writable") ? descriptor.writable : true) ||
					!(owns(descriptor, "enumerable") ? descriptor.enumerable : true) ||
					!(owns(descriptor, "configurable") ? descriptor.configurable : true)
				)
					throw new RangeError(
						"This implementation of Object.defineProperty does not " +
						"support configurable, enumerable, or writable."
					);
				*/

				if (supportsAccessors && (lookupGetter(object, property) ||
											lookupSetter(object, property)))
				{
					// As accessors are supported only on engines implementing
					// `__proto__` we can safely override `__proto__` while defining
					// a property to make sure that we don't hit an inherited
					// accessor.
					var prototype = object.__proto__;
					object.__proto__ = prototypeOfObject;
					// Deleting a property anyway since getter / setter may be
					// defined on object itself.
					delete object[property];
					object[property] = descriptor.value;
					// Setting original `__proto__` back now.
					object.__proto__ = prototype;
				} else {
					object[property] = descriptor.value;
				}
			} else {
				if (!supportsAccessors) {
					throw new TypeError(ERR_ACCESSORS_NOT_SUPPORTED);
				}
				// If we got that far then getters and setters can be defined !!
				if (owns(descriptor, "get")) {
					defineGetter(object, property, descriptor.get);
				}
				if (owns(descriptor, "set")) {
					defineSetter(object, property, descriptor.set);
				}
			}
			return object;
		};
	}

	// ES5 15.2.3.7
	// http://es5.github.com/#x15.2.3.7
	if (!Object.defineProperties || definePropertiesFallback) {
		Object.defineProperties = function defineProperties(object, properties) {
			// make a valiant attempt to use the real defineProperties
			if (definePropertiesFallback) {
				try {
					return definePropertiesFallback.call(Object, object, properties);
				} catch (exception) {
					// try the shim if the real one doesn't work
				}
			}

			for (var property in properties) {
				if (owns(properties, property) && property != "__proto__") {
					Object.defineProperty(object, property, properties[property]);
				}
			}
			return object;
		};
	}

	// ES5 15.2.3.8
	// http://es5.github.com/#x15.2.3.8
	if (!Object.seal) {
		Object.seal = function seal(object) {
			// this is misleading and breaks feature-detection, but
			// allows "securable" code to "gracefully" degrade to working
			// but insecure code.
			return object;
		};
	}

	// ES5 15.2.3.9
	// http://es5.github.com/#x15.2.3.9
	if (!Object.freeze) {
		Object.freeze = function freeze(object) {
			// this is misleading and breaks feature-detection, but
			// allows "securable" code to "gracefully" degrade to working
			// but insecure code.
			return object;
		};
	}

	// detect a Rhino bug and patch it
	try {
		Object.freeze(function () {});
	} catch (exception) {
		Object.freeze = (function freeze(freezeObject) {
			return function freeze(object) {
				if (typeof object == "function") {
					return object;
				} else {
					return freezeObject(object);
				}
			};
		})(Object.freeze);
	}

	// ES5 15.2.3.10
	// http://es5.github.com/#x15.2.3.10
	if (!Object.preventExtensions) {
		Object.preventExtensions = function preventExtensions(object) {
			// this is misleading and breaks feature-detection, but
			// allows "securable" code to "gracefully" degrade to working
			// but insecure code.
			return object;
		};
	}

	// ES5 15.2.3.11
	// http://es5.github.com/#x15.2.3.11
	if (!Object.isSealed) {
		Object.isSealed = function isSealed(object) {
			return false;
		};
	}

	// ES5 15.2.3.12
	// http://es5.github.com/#x15.2.3.12
	if (!Object.isFrozen) {
		Object.isFrozen = function isFrozen(object) {
			return false;
		};
	}

	// ES5 15.2.3.13
	// http://es5.github.com/#x15.2.3.13
	if (!Object.isExtensible) {
		Object.isExtensible = function isExtensible(object) {
			// 1. If Type(O) is not Object throw a TypeError exception.
			if (Object(object) !== object) {
				throw new TypeError(); // TODO message
			}
			// 2. Return the Boolean value of the [[Extensible]] internal property of O.
			var name = '';
			while (owns(object, name)) {
				name += '?';
			}
			object[name] = true;
			var returnValue = owns(object, name);
			delete object[name];
			return returnValue;
		};
	}

	// ES5 15.2.3.14
	// http://es5.github.com/#x15.2.3.14
	if (!Object.keys) {
		// http://whattheheadsaid.com/2010/10/a-safer-object-keys-compatibility-implementation
		var hasDontEnumBug = true,
			dontEnums = [
				"toString",
				"toLocaleString",
				"valueOf",
				"hasOwnProperty",
				"isPrototypeOf",
				"propertyIsEnumerable",
				"constructor"
			],
			dontEnumsLength = dontEnums.length;

		for (var key in {"toString": null}) {
			hasDontEnumBug = false;
		}

		Object.keys = function keys(object) {

			if ((typeof object != "object" && typeof object != "function") ||	object === null	) {
				throw new TypeError("Object.keys called on a non-object");
			}

			var keys = [];
			for (var name in object) {
				if (owns(object, name)) {
					keys.push(name);
				}
			}

			if (hasDontEnumBug) {
				for (var i = 0, ii = dontEnumsLength; i < ii; i++) {
					var dontEnum = dontEnums[i];
					if (owns(object, dontEnum)) {
						keys.push(dontEnum);
					}
				}
			}
			return keys;
		};
	}


});	/* end define() */
