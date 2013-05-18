//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/lang",
				"./Listener",
				"../_base/Library",
				"../error/createError!../error/StoreErrors.json"
			 ], function (lang, Listener, Lib, createError) {
	"use strict";
	// module:
	//		indexedStore/listener/ListenerList
	// summary:
	//		This module implements the ListenerList object. A ListenerList object
	//		is a container of Listener instances arranged by type.
	
	var StoreError = createError( "ListenerList" );		// Create the StoreError type.
	var isString   = Lib.isString;
	
	function assert( object, method ) {
		if (!object || !(object instanceof ListenerList)) {
			throw new StoreError("TypeError", method, "object does not implement the ListenerList interface");	
		}
	}

	function ListenerList (actions) {
		// summary:
		//		Create a new instance of ListenerList
		// actions: Actions?
		//		Instance of indexedStore/listener/Actions, if specified the actions
		//		will be associated with the ListenerList (see also setActions())
		// tag:
		//		public
		
		function removeAll(type) {
			// summary:
			//		Remove all registered listeners for a given type. If type is omitted
			//		all listeners, regardless of type, are removed.
			// type: String?
			//		Type of listener to remove
			// tag:
			//		public
			if (type) {
				if (type instanceof Array) {
					type.forEach(  function (type) {
						clearListener(type);
					}, this);
				} else if (isString(type)) {
					if (/,/.test(type)) {
						clearListener(type.split(/\s*,\s*/) );
					}	else {
						var lsByType = listeners[type];
						if (lsByType) {
							delete listeners[type];
							self.length -= lsByType.length;
						}
					}
				} else {
					throw new StoreError("Parameter", "removeAll", "invalid type argument");
				}
			} else {
				listeners = [];
				self.length = 0;
			}
		}

		this.addListener = function (type, listener, scope) {
			// summary:
			//		Add a listener to the list.
			// type: String|String[]
			//		Listener type, similar to an event type.
			// listener: Listener|Function|String
			//		Callback function, an instance of Listener or a string
			// scope: Object?
			//		Object to use as 'this' when invoking the listener.
			// returns: Object
			//		An object which has a remove method which can be called to remove
			//		the listener from the ListenerList.
			// tag:
			//		Public

			if (listener) {
				if (type instanceof Array) {
					type.forEach( function(type) {
						self.addListener(type, listener, scope);
					});
				} else if (isString(type)) {
					if (/,/.test(type)) {
						return self.addListener( type.split(/\s*,\s*/), listener, scope );
					}
					self.removeListener( type, listener );
					var lsByType = listeners[type] || [];

					listener = new Listener( listener, scope );

					lsByType.push(listener);
					listeners[type] = lsByType;
					self.length++;
				} else {
					throw new StoreError("Parameter", "addListener", "invalid type argument");
				}
				return {
					remove: function () {
						self.removeListener( type, listener, scope );
					}
				}
			} else {
				throw new StoreError("Parameter", "addListener", "listener argument required");
			}
		};

		this.getByType = function (type) {
			// summary:
			//		Returns all listeners for a give type.
			// type: String?
			//		The type for which the listeners are to be retrieved.
			// returns: Object|Array
			//		If type is specified an array of all listeners for the given type,
			//		otherwise a key:value pairs object with each key representing a
			//		type and the value being an array of all listeners for that type.
			// tag:
			//		Public
			var list = {};
			if (type) {
				list = (listeners[type] || []).slice();
			} else {
				for (type in listeners) {
					list[type] = listeners[type].slice();
				}
			}
			return list;
		};

		this.getByCallback = function (type, callback) {
			// summary:
			// type: String
			// callback: Function
			// tag:
			//		Public
			
			if (typeof callback == "function") {
				var lsByType = listeners[type];
				var listener;
				
				if (lsByType) {
					lsByType.some( function (handler, idx) {
						if (handler.callback == callback) {
							listener = lsByType[idx];
							return true;
						}
					});
				}
				return listener;
			}
			throw new StoreError("Parameter", "getByCallback", "callback is not a callable object");
		}
		
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
					listener = new Listener( listener, scope );
				}
				if (type instanceof Array) {
					type.forEach( function(type) {
						self.removeListener(type, listener, scope);
					});
				} else if (isString(type)) {
					if (/,/.test(type)) {
						self.removeListener(type.split(/\s*,\s*/), listener, scope);
					} else {
						var lsByType = listeners[type];
						if (lsByType) {
							lsByType.some( function (handler, idx) {
								if ((handler.bind == listener.bind && handler.scope == listener.scope) ||
										(handler.callback == listener.callback)) {
									lsByType.splice(idx, 1);
									self.length--;
									return true;
								}
							});
							if (!lsByType.length) {
								delete listeners[type];
							}
						}
					}
				} else {
					throw new StoreError("Parameter", "addListener", "invalid type argument");
				}
			} else {
				removeAll(type);
			}
		};

		this.setActions = function (actions) {
			// summary:
			// actions:
			// tag:
			//		Public
			if (actions) {
				if (typeof actions.after == "function" && typeof actions.before == "function") {
					this.actions = actions;
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
			//				callback(type [,arg0 [,arg1, ... ,argN]] )
			//
			// type: String
			//		Listener type.
			// tag:
			//		Public
			if (isString(type)) {
				var lst = listeners[type];
				var act = self.actions && self.actions.trigger(type,"before");
				if (lst) {
					var vargs = Array.prototype.slice.call(arguments, 1);
					var a, c, i, T, l;
					for (i=0; i<lst.length;i++) {
						l = lst[i], T = l.scope;
						c = l.callback || (T || window)[l.bind];
						a = l.args ? [].concat(type, l.args, vargs) : arguments;
						if (c instanceof Function) {
							c.apply( T, a );
						}
					}
				}
				act = self.actions && self.actions.trigger(type,"after");
			} else {
				throw new StoreError("Parameter", "trigger", "invalid type argument");
			}
		};

		var listeners = {};
		var self = this;

		this.length = 0;

		if (actions) {
			this.setActions(actions);
		}

	}
	return ListenerList;
	
});	/* end define() */
