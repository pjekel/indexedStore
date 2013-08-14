define(["./library",
		"../dom/event/Event",
		"../dom/event/EventTarget",
		"../error/createError!../error/StoreErrors.json",
		"../listener/ListenerList"
	], function (lib, Event, EventTarget, createError, ListenerList) {
	"use strict";

	// module:
	//		indexedStore/_base/Directives
	// description:
	//		Directives are 'special' properties of an object.

	var C_MSG_INVALID_TYPE = "invalid directive type specified";
	var C_MSG_REDECLARE    = "directive [%{0}] already declared %{1}";

	var StoreError = createError("Directives");		// Create the StoreError type.
	var typeNames  = ["public", "protected", "private"];
	var isObject   = lib.isObject;
	var isString   = lib.isString;
	var mixinOwn   = lib.mixinOwn;
	var clone      = lib.clone;

	function Directives(parent, directives, defaults, type) {
		// summary:
		//		Create a new instance of Directives.
		// parent: Object?
		// directives: (Object|String|String[])?
		// defaults: Object?
		// type: Number?
		// tag:
		//		public

		EventTarget.call(this, parent);
		EventTarget.declareHandler(this, "set");	// Create specialty onset property

		var directList = [{}, {}, {}];
		var properties = {};
		var names      = [];
		var savedProps = null;
		var self       = this;
		var watchers   = new ListenerList();

		//====================================================================
		// Private methods

		function getType(name) {
			// summary:
			//		Get the type of a directive
			// name: String
			//		Directive name
			// returns: Number
			// tag:
			//		private
			var type = -1;
			directList.some(function (list, idx) {
				if (list.hasOwnProperty(name)) {
					type = idx;
					return true;
				}
			});
			return type;
		}

		function normalize(base, value) {
			// summary:
			//		Normalize boolean and numeric directives. If base is either a
			//		a boolean or a number the value is converted accordingly.
			// base: any
			//		Determines the type of the returned value. For example, if base
			//		is a boolean then value is returned as a boolean.
			// value: any
			//		Value to be normalized.
			// tag:
			//		private
			if (typeof base == "boolean") {
				value = !!value;
			} else if (typeof base == "number") {
				value = Number(value) || 0;
			}
			return value;
		}

		function signalUpdate(directive, newVal, oldVal) {
			// summary:
			//		Signal an update to one of the directive values.
			// directive: String
			//		Directive name
			// newVal: any
			//		New value
			// oldVal: any
			//		Old value
			// tag:
			//		private
			if (watchers.length) {
				watchers.trigger(directive, newVal, oldVal);
			}
			var detail = {directive: directive, newVal: newVal, oldVal: oldVal};
			self.dispatchEvent(new Event("set", {detail: detail}));
		}

		//====================================================================
		// Public methods

		this.declare = function (directives, defaults, type) {
			// summary:
			//		Declare the directives.   There are three types of directives,
			//		public, protected and private.   Public directives are exposed
			//		as writable properties of the parent. Protected directives are
			//		exposed as read-only properties of the parent while private
			//		directives are not exposed at all.  Both protected and private
			//		directives can only be set using the set() method. In addition
			//		private directives can only be retrieved using the get() method.
			// directives: Object|String|String[]
			//		A JavaScript key:value pairs object, a string or a string array.
			//		If an object, each key represents a single directive
			// defaults: Object?
			// type: Number?
			// tag:
			//		public
			var baseObj = {}, declareDir, dirAry, dirNames;

			if (!isObject(directives)) {
				dirAry = lib.anyToArray(directives);
				dirAry.forEach(function (dirName) {
					if (isString(dirName)) {
						baseObj[dirName] = undefined;
					}
				});
			} else {
				// Clone directives so we don't alter the original values.
				baseObj = clone(directives, false);
			}

			declareDir = mixinOwn(null, baseObj, defaults);
			dirNames   = Object.keys(baseObj);
			type       = Number(type) || Directives.PUBLIC;
			names      = [];

			dirNames.forEach(function (name) {
				var value  = declareDir[name];
				var exists = getType(name);
				var desc   = {
					get: function () {return properties[name]; },
					set: function (value) {
						var oldVal = properties[name];
						properties[name] = value;
						signalUpdate(name, value, oldVal);
					},
					configurable: true,
					enumerable: true
				};
				if (exists > -1 && exists != type) {
					throw new StoreError("TypeError", "declare", C_MSG_REDECLARE, name, typeNames[exists]);
				}
				if (parent) {
					switch (type) {
						case Directives.PUBLIC:
							lib.defProp(parent, name, desc);
							break;
						case Directives.PROTECTED:
							lib.defProp(parent, name, {
								get: function () {return properties[name]; },
								configurable: true,
								enumerable: false
							});
							break;
						case Directives.PRIVATE:
							lib.defProp(parent, name, {
								get: function () {
									throw new TypeError(name + " is a private property");
								},
								set: function () {
									throw new TypeError(name + " is a private property");
								},
								configurable: true,
								enumerable: false
							});
							break;
						default:
							throw new StoreError("DataError", "declare", C_MSG_INVALID_TYPE);
					}
				}
				lib.defProp(directList[type], name, desc);
				properties[name] = value;
			});
			savedProps = clone(properties, false);
			directList.forEach(function (list) {
				names = names.concat(Object.keys(list));
			});
			names.sort();
		};

		this.get = function (nameOrType /* *[,obj] */) {
			// summary:
			// nameOrType: String | Number
			//		Directive name or type
			// obj: Object?
			// returns: any
			// tag:
			//		public
			var objs = Array.prototype.slice.call(arguments, 1);
			var name = nameOrType;
			var type = nameOrType;
			var list;

			if (nameOrType && type !== Directives.ALL) {
				if (isString(name)) {
					type = this.getType(name);
					if (type > -1) {
						list = directList[type][name];
						if (objs.length) {
							list = mixinOwn.apply(null, [null, list].concat(objs));
						}
						return list[name];
					}
				} else if (typeof type == "number") {
					list = mixinOwn.apply(null, [null, directList[type]].concat(objs));
					return list;
				}
			} else {
				list = mixinOwn.apply(null, [null, properties].concat(objs));
				return list;
			}
		};

		this.isDirective = function (name) {
			// summary:
			// name: String
			//		Directive name
			// returns: Boolean
			// tag:
			//		public
			if (isString(name)) {
				return names.indexOf(name) != -1;
			}
			throw new StoreError("TypeError", "isDirective");
		};

		this.reset = function () {
			// summary:
			//		Reset all directives to their declared default values. Resetting
			//		the directives will undo all calls to the set() method.
			// returns: Object
			//		All directives after reset.
			// tag:
			//		public
			if (savedProps !== null) {
				properties = savedProps;
			}
			return this.getAll();
		};

		this.set = function (name, value) {
			// summary:
			// name: String
			//		Directive name
			// value: any
			// returns: 'this'
			// tag:
			//		public
			var base, key, type;
			if (name) {
				if (isObject(name)) {
					for (key in name) {
						this.set(key, name[key]);
					}
				} else {
					type = this.getType(name);
					if (type > -1) {
						base = directList[type][name];
						directList[type][name] = normalize(base, value);
					}
				}
			}
			return this;
		};

		this.watch = function (directive, listener, scope) {
			// summary:
			//		If the specified directive changes a 'set' event will be generated
			//		and, if specified, the listener is notified.
			// directive: String|String[]
			//		Directive name(s)
			// listener: Function|Listener?
			//		Callback, if specified the listener is called when the directive
			//		changed. The signature of listener is as follows:
			//			listener(directive, newValue, oldValue)
			//  scope: Object?
			//		Object to use as this in the callback function body.
			// returns: Object
			//		An object which has a remove method which can be called to remove
			//		the listener from the ListenerList.
			// tag:
			//		Public

			if (directive) {
				var props = lib.anyToArray(directive);
				props.forEach(function (prop) {
					watchers.addListener(prop, listener, scope);
				});
				return {
					remove: function () {
						self.unwatch(directive, listener, scope);
					}
				};
			}
		};

		this.unwatch = function (directive, listener, scope) {
			// summary:
			//		Remove a listener.
			// directive: String|String[]
			//		Directive name.
			// listener: Function|Listener?
			//		Function or a Listener object. If a listener is specified only the
			//		specific listener is removed otherwise all available listeners for
			//		the directive are removed.
			// scope: Object?
			//		The scope associated with the listener. The scope argument is only
			//		required when the listener argument is a string, in all other cases
			//		scope is ignored.
			// tag:
			//		Public
			if (directive) {
				var props = lib.anyToArray(directive);
				props.forEach(function (prop) {
					watchers.removeListener(prop, listener, scope);
				});
			}
		};

		//====================================================================

		lib.defProp(this, "directives", { get: function () {return names; }, enumerable: true });
		lib.defProp(this, "length", { get: function () {return names.length; }, enumerable: true });

		if (directives) {
			this.declare(directives, defaults, type);
		}
	} /* end Directives() */

	// Declare the directive types.
	Directives.PUBLIC    = 0;
	Directives.PROTECTED = 1;
	Directives.PRIVATE   = 2;
	Directives.ALL       = 3;

	Directives.prototype = new EventTarget();
	Directives.prototype.constructor = Directives;

	return Directives;
});
