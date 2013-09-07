//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../_base/library",
		"../error/createError!../error/StoreErrors.json",
		"./Listener"
	], function (lib, createError, Listener) {
	"use strict";
	// module:
	//		indexedStore/listener/ListenerList
	// summary:
	//		This module implements the ListenerList object. A ListenerList object
	//		is a container of Listener instances arranged by type.

	var C_ANYTYPE = "*";

	var ListError = createError("ListenerList");		// Create the ListError type.
	var isString  = lib.isString;
	var defProp   = lib.defProp;

	function isValidType(type) {
		return (isString(type) || typeof type == "number");
	}

	function ListenerList(actions) {
		// summary:
		//		Create a new instance of ListenerList
		// actions: Actions?
		//		Instance of indexedStore/listener/Actions, if specified the actions
		//		will be associated with the ListenerList (see also setActions())
		// tag:
		//		public
		var destroyed = false;
		var listeners = {};
		var count     = 0;
		var self      = this;

		//=====================================================================
		// Private methods

		function insertListener(type, listener, priority) {
			// summary:
			//		Insert a listener in order of its priority. The order of listeners
			//		determines the order in which they will be invoked when triggered.
			//		Listeners without priority will be invoked last in the order they
			//		have been submitted.
			// type: String
			//		Type of listener
			// listener: Listener
			//		Instance of Listener
			// priority: Number?
			// tag:
			//		private
			var lsByType = listeners[type] || [];
			var length = lsByType.length;
			var idx = 0, prio;

			if (length && typeof priority == "number") {
				for (idx = 0; idx < length; idx++) {
					prio = lsByType[idx].priority;
					if (prio === undefined || priority < prio) {
						break;
					}
				}
				listener.priority = priority;
			}
			lsByType.splice(idx, 0, listener);
			return lsByType;
		}

		function removeAll(type) {
			// summary:
			//		Remove all registered listeners for a given type. If type is omitted
			//		all listeners, regardless of type, are removed.
			// type: String?
			//		Type of listener to remove
			// tag:
			//		public
			if (type) {
				var types = lib.anyToArray(type);
				types.forEach(function (type) {
					if (isValidType(type)) {
						var lsByType = listeners[type];
						if (lsByType) {
							delete listeners[type];
							count -= lsByType.length;
						}
					} else {
						throw new ListError("Parameter", "removeAll", "invalid type argument");
					}
				});
			} else {
				listeners = {};
				count = 0;
			}
		}

		function triggerActions(actions, type, aspect, vargs) {
			// summary:
			// actions: Actions
			//		Instance of indexedStore/listener/Actions
			// type: String | Number
			// aspect: String
			// vargs: any[]
			// tag:
			//		private
			if (actions) {
				actions.trigger.apply(actions, [type, aspect].concat(vargs));
			}
		}

		function triggerListener(listeners, type, vargs, scope) {
			// summary:
			// listeners: Listener[]
			// type: String | Number
			// vargs: any[]
			// tag:
			//		private
			listeners.forEach(function (lstn) {
				var func = lstn.listener || (lstn.scope || scope || window)[lstn.bindName];
				var args = [type].concat((lstn.args || []), vargs);
				if (func instanceof Function) {
					func.apply((lstn.scope || scope), args);
				}
			});
		}

		//=====================================================================
		// Public methods

		this.addListener = function (type, listener, scope, priority) {
			// summary:
			//		Add a listener to the list.
			// type: String|String[]
			//		Listener type, similar to an event type.
			// listener: Listener|Function|String
			//		Callback function, an instance of Listener or a string
			// scope: Object?
			//		Object to use as 'this' when invoking the listener.
			// priority: Number?
			//		Determines the order in which listeners for the same trigger
			//		type are invoked. If omitted the listener is added to the end
			//		of the list. Listeners with priority are sorted in ascending
			//		order. (lowest number has the highest priority).
			// returns: Object
			//		An object which has a remove method which can be called to remove
			//		the listener from the ListenerList.
			// tag:
			//		Public
			var types;

			if (destroyed) {
				throw new ListError("InvalidState", "addListener", "ListenerList was destroyed");
			}
			if (type && listener) {
				if (arguments.length == 3 && typeof arguments[2] == "number") {
					priority = arguments[2];
					scope    = undefined;
				}
				types = lib.anyToArray(type);
				types.forEach(function (type) {
					if (isValidType(type)) {
						this.removeListener(type, listener);
						listener = new Listener(listener, scope);
						listeners[type] = insertListener(type, listener, priority);
						count++;
					} else {
						throw new ListError("Parameter", "addListener", "invalid type argument");
					}
				}, this);
				return {
					remove: function () {
						self.removeListener(type, listener, scope);
					}
				};
			}
			throw new ListError("Parameter", "addListener", "required argument missing");
		};

		this.destroy = function () {
			// summary:
			//		Destroy the listenerList. Effectively all registered listeners are
			//		removed from the list.
			// tag:
			//		Public
			this.actions = null;
			removeAll();
			destroyed = true;
		};

		this.getByType = function (type) {
			// summary:
			//		Returns all listeners for a give type.
			// type: String?
			//		The type for which the listeners are to be retrieved.
			// returns: Listener[] | Object
			//		If type is specified an array of all listeners for the given type,
			//		otherwise a key:value pairs object with each key representing a
			//		type and the value being an array of all listeners for that type.
			// tag:
			//		Public
			var key, list = {};
			if (type) {
				list = (listeners[type] || []).slice();
			} else {
				for (key in listeners) {
					list[key] = listeners[key].slice();
				}
			}
			return list;
		};

		this.getByCallback = function (type, callback) {
			// summary:
			//		Get a listener by its callback
			// type: String
			// callback: Function
			// tag:
			//		Public
			if (typeof callback == "function") {
				var lsByType = listeners[type];
				var listener;

				if (lsByType) {
					lsByType.some(function (l, i) {
						if (l.listener == callback) {
							listener = lsByType[i];
							return true;
						}
					});
				}
				return listener;
			}
			throw new ListError("Parameter", "getByCallback", "callback is not a callable object");
		};

		this.getListeners = function () {
			// summary:
			//		Get all listeners
			// returns: Object
			//		A JavaScript key:value pairs object. Each object key represents
			//		a listener type, the value is an array of Listener objects for
			//		the given type.
			// tag:
			//		public
			return this.getByType();
		};

		this.removeListener = function (type, listener, scope) {
			// summary:
			//		Remove a listener from the list
			// type: String|String[]?
			//		Type(s) of Listener(s) to remove. If both the type and listener are
			//		omitted all listeners will be removed.
			// listener: (Listener|Function|String)?
			//		Listener to be removed. If listener is omitted all listener of the
			//		give type are removed.
			// scope: Object?
			//		The scope associated with the listener. The scope argument is only
			//		required when the listener argument is a string, in all other cases
			//		scope is ignored.
			// tag:
			//		Public

			if (listener) {
				if (!(listener instanceof Listener)) {
					listener = new Listener(listener, scope);
				}
				var types = lib.anyToArray(type);
				types.forEach(function (type) {
					if (isValidType(type)) {
						var lsByType = listeners[type];
						if (lsByType) {
							lsByType.some(function (l, i) {
								if ((l.bindName && (l.bindName == listener.bindName && l.scope == listener.scope)) ||
										(l.listener == listener.listener)) {
									lsByType.splice(i, 1);
									count--;
									return true;
								}
							});
							if (!lsByType.length) {
								delete listeners[type];
							}
						}
					} else {
						throw new ListError("Parameter", "removeListener", "invalid type argument");
					}
				});
			} else {
				removeAll(type);
			}
		};

		this.setActions = function (actions) {
			// summary:
			//		Associate actions with the ListenerList
			// actions:
			//		Instance of Actions
			// tag:
			//		Public
			if (actions) {
				if (typeof actions.after == "function" && typeof actions.before == "function") {
					this.actions = actions;
				} else {
					throw new ListError("Parameter", "setActions", "invalid actions argument");
				}
			}
		};

		this.trigger = function (type /*[,arg0 [,arg1, ... ,argN]]*/) {
			// summary:
			//		Invoke all listener registered for the given type.  If a listener
			//		requires late binding, that is,  the listener has a bind property
			//		and callback is undefined, an attempt is made to resolve the bind
			//		name. The bind name must represent a callable object. The listener
			//		type is passed to the callback as the first argument. The callback
			//		signature is as follows:
			//
			//				callback(type [,arg0 [,arg1, ... ,argN]])
			//
			// type: String|Number
			//		Listener type.
			// tag:
			//		Public
			var vargs  = Array.prototype.slice.call(arguments, 1);
			var lsByType;

			if (isValidType(type) && type !== C_ANYTYPE) {
				lsByType  = listeners[type] || [];
				if (this.actions) {
					triggerActions(this.actions, type, "before", vargs);
					triggerListener(lsByType, type, vargs);
					triggerActions(this.actions, type, "after", vargs);
				} else {
					triggerListener(lsByType, type, vargs);
				}
			} else {
				throw new ListError("TypeError", "trigger", "invalid type argument");
			}
		};

		//=====================================================================

		defProp(this, "types", {get: function () { return Object.keys(listeners); }, enumerable: true});
		defProp(this, "length", {get: function () { return count; }, enumerable: true});

		if (actions) {
			this.setActions(actions);
		}
	}
	return ListenerList;
});	/* end define() */
