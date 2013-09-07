//
// Copyright (c) 2012-2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../../_base/library",
		"../../listener/Listener",
		"../../listener/ListenerList",
		"../../error/createError!../../error/StoreErrors.json",
		"./EventDefaults",
		"./Event"
		], function (lib, Listener, ListenerList, createError, EventDefaults, Event) {
	"use strict";

	// module:
	//		indexedStore/dom/event/EventTarget
	// summary:
	//		Implements the DOM 3/4 EventTarget interface
	//
	//	http://www.w3.org/TR/dom/		(DOM4)
	//	http://www.w3.org/TR/DOM-Level-3-Events/

	var StoreError   = createError("EventTarget");		// Create the StoreError type.
	var emptyHandler = function (event) { return false; };
	var NativeEvent  = window.Event;
	var PROPERTY     = "parent";

	var unhandled = lib.getProp("indexedStore.event.unhandledError", null, true);

	function isTarget(target) {
		return (target instanceof EventTarget || target.isInstanceOf(EventTarget));
	}

	function propagate(path, phase, event) {
		// summary:
		//		Iterate the propagation path for the event.
		// path: EventTarget[]
		//		The propagation path which is an array of event targets.
		// phase: Number
		//		Propagation phase. The phase is either CAPTURING_PHASE, AT_TARGET or
		//		BUBBLING_PHASE
		// event: Event
		//		Event to be dispatched.
		// returns: Boolean
		//		True if further event propagation is to be stopped otherwise false.
		// tag:
		//		Private
		var cb, handled, i = 0, j, lstn, listeners, evt = event;
		var curTarget = path[i++];

		while (curTarget && !evt._stopPropagate) {
			if (isTarget(curTarget)) {
				listeners = curTarget.getEventListeners(evt.type, phase);
				j = 0;
				if (listeners && listeners.length) {
					evt.currentTarget = curTarget;
					evt.eventPhase    = phase;
					lstn = listeners[j++];

					while (lstn && !evt._stopImmediate) {
						// Make sure the event propagation is not interrupted and that any
						// exception thrown by the handler is caught here.
						try {
							cb = lstn.listener || (lstn.scope || window)[lstn.bindName];
							if (cb) {
								// If the handler returns anything other than false
								// it is assumed the handler processed the event.
								if (cb.call(curTarget, evt) !== false) {
									event._handled = true;
								}
							}
						} catch (err) {
							if (!event._handlerError) {
								lib.defProp(event, "_handlerError", {value: err});
							}
						}
						lstn = listeners[j++];
					}
				}
			}
			curTarget = path[i++];
		}
		return !evt._stopPropagate;
	}

	function validatePath(path, target) {
		// summary:
		//		Validate the propagation path. This function is called whenever a specific
		//		path is specified when dispatching an event. Each target in the path must
		//		be an instance of EventTarget. If the path is the event target itself or
		//		an empty array the event is only fired at the target.
		// path: EventTarget[]
		//		Event target or an array of event targets.
		// target: EventTarget
		//		The Event target.
		// tag:
		//		private
		path = (path instanceof Array) ? path : [path];
		return path.filter(function (evtTarget) {
			return (evtTarget instanceof EventTarget && evtTarget != target);
		});
	}

	function EventTarget(parent) {
		// summary:
		//		Implements the DOM Level 3/4 EvenTarget interface.
		//		http://www.w3.org/TR/dom/#interface-eventtarget
		// parent: Object?
		//		Optional, the parent object of this Event Target.
		// tag:
		//		Public

		// Declare a ListenerList for each event phase..
		var lists = {
			bubbling: new ListenerList(),
			capture: new ListenerList()
		};

		this.getEventListeners = function (type, phase) {
			// summary:
			//		Return the list of event listeners for a given event type.
			// type: String?
			//		The event type
			// phase: Number?
			//		The event propagation phase. The propagation phase can be either:
			//		CAPTURING_PHASE (1), AT_TARGET (2) and BUBBLING_PHASE (3).
			// returns: Object|Array
			//		See indexedStore/listener/ListenerList.getByType()
			// tag:
			//		Public
			var list = (phase == Event.CAPTURING_PHASE) ? lists.capture : lists.bubbling;
			return list.getByType(type);
		};

		this.addEventListener = function (type, callback, useCapture) {
			// summary:
			//		Registers an event listener, depending on the useCapture parameter,
			//		on the capture phase of the DOM event flow or its target and bubbling
			//		phases.
			// type: String
			//		Specifies the type associated with the event for which the listener
			//		is registering.
			// callback: EventListener|Function
			//		The callback parameter must be either an object that implements the
			//		EventListener interface, or a function.
			// useCapture: Boolean?
			//		If true, useCapture indicates that the user wishes to add the event
			//		listener for the capture and target phases only, i.e., this event
			//		listener will not be triggered during the bubbling phase. If false,
			//		the event listener is only be triggered during the target and bubbling
			//		phases.
			// returns: Object
			//		An object which has a remove method which can be called to remove
			//		the listener.
			// tag:
			//		Public

			var eventList = !!useCapture ? lists.capture : lists.bubbling;
			return eventList.addListener(type, callback);
		};

		this.on = function (type, callback) {
			// summary:
			//		Registers an event listener. This method is to provide support for
			//		dojo/on but can also be use as an alias for addEventListener.
			//		However, this method only registers event listeners for the bubble
			//		phase.
			// type: String
			//		Specifies the Event.type associated with the event for which the user
			//		is registering. Type is either a string or a list of comma separated
			//		types.
			// callback: EventListener|Function
			//		The callback parameter must be either an object that implements the
			//		EventListener interface, or a function.
			// tag:
			//		Public
			return this.addEventListener(type, callback, false);
		};

		this.removeEventListener = function (type, callback, useCapture) {
			// summary:
			//		Removes an event listener. Calling removeEventListener with arguments
			//		which do not identify any currently registered EventListener on the
			//		EventTarget has no effect.
			// type: String
			//		Specifies the type for which the user registered the event listener.
			// callback: EventListener
			//		The EventListener to be removed.
			// useCapture: Boolean?
			//		Specifies whether the EventListener being removed was registered for
			//		the capture phase or not. If a listener was registered twice, once
			//		for the capture and target phases and once for the target and bubbling
			//		phases, each must be removed separately. Removal of an event listener
			//		registered for the capture and target phases does not affect the same
			//		event listener registered for the target and bubbling phases, and vice
			//		versa.
			// tag:
			//		Public

			var eventList = !!useCapture ? lists.capture : lists.bubbling;
			eventList.removeListener(type, callback);
		};

		this.dispatchEvent = function (event, propagationPath) {
			// summary:
			//		Dispatches an event into the implementation's event model. If no
			//		path is specified it is compiled using the existing hierarchy.
			// event: Event
			//		The event to be dispatched.
			// propagationPath: EventTarget[]?
			//		The event propagation path. If omitted, the propagtion path is the
			//		list of all ancestors of the event target. (See PROPERTY). Several
			//		standards allow applications to explicitly specify the propagation
			//		path of an event. For example, the IndexedDB standard.
			//		The propagationPath is typically used with non-DOM objects.
			// tag:
			//		Public

			if (event instanceof Event && event.type) {
				if (!event._dispatch && event.eventPhase == Event.NONE) {
					var parent = this[PROPERTY];
					var path   = [];

					if (propagationPath) {
						path = validatePath(propagationPath, this);
					} else {
						while (parent) {
							path.unshift(parent);
							parent = parent[PROPERTY];
						}
					}
					event._dispatch = true;
					event.target   = this;

					// Trigger any default actions required BEFORE dispatching
					if (!event.defaultPrevented) {
						try {
							EventDefaults.trigger(event.type, "before", event);
						} catch (err0) {}
					}
					if (!event._stopPropagate) {
						// If there is no propagation path simply fire the event at the
						// target (e.g. 'this');
						if (!path.length) {
							propagate([this], Event.AT_TARGET, event);
						} else {
							if (propagate(path, Event.CAPTURING_PHASE, event)) {
								if (propagate([this], Event.AT_TARGET, event) && event.bubbles) {
									propagate(path.reverse(), Event.BUBBLING_PHASE, event);
								}
							}
						}
					}
					// Trigger any default actions required AFTER dispatching
					if (!event.defaultPrevented) {
						try {
							EventDefaults.trigger(event.type, "after", event);
						} catch (err1) {}
					}
					// Reset the event.
					event.currentTarget = null;
					event.eventPhase    = Event.NONE;
					event._dispatch     = false;

					if (!event._handled && event.type === "error") {
						EventTarget.unhandledError(event);
					}
					// If any of the event handlers threw an exception re-throw
					// it now.
					if (event._handlerError) {
						throw event._handlerError;
					}
					return !event.defaultPrevented;
				}
				throw new StoreError("InvalidStateError", "dispatchEvent");
			} else {
				if (event instanceof NativeEvent) {
					event = new Event(event);
					if (event) {
						return this.dispatchEvent(event, propagationPath);
					}
				}
			}
			throw new StoreError("TypeError", "dispatchEvent", "invalid event");
		};	/* end dispatchEvent() */

		// Add the 'parent' property to the EvenTarget
		lib.defProp(this, PROPERTY, {value: parent,	enumerable: true, writable: true,
									 configurable: true});
	} /* end EventTarget() */

	EventTarget.declareHandler = function (target, types) {
		// summary:
		//		Add an event handler property to the target.
		// description
		//		Add an event handler to the store.  Adding an event handler adds
		//		a special property to the store with the name: on<type>.
		//		The new property can be assigned a function with a prototype of:
		//			function handler(event) { ... }
		//		Assigning the property a function will register the function as
		//		an event listener for the specified type.  However, reassigning
		//		the property results in the removal of current listener.
		//		If multiple listeners are required for the same event type use
		//		the addEventListener() method instead.
		// target: EventTarget
		// types: String|String[]
		//		A string or a comma-separated-value string or an array of strings
		//		specifying the event type(s) for which an handler entry is declared.
		// example:
		//	|	EventTarget.declareHandler(store, "error");
		//	|	store.onerror = function (event) {
		//	|	          ...
		//	|	};
		// tag:
		//		public
		if (!isTarget(target)) {
			throw new StoreError("TypeError", "declareHandler", "target is not an EventTarget");
		}
		types = lib.anyToArray(types);
		types.forEach(function (type) {
			if (lib.isString(type)) {
				var eventType = type.toLowerCase().replace(/^on/, "");
				var property  = "on" + eventType;
				var listener  = null;

				lib.defProp(target, property, {
					get: function () {
						return listener;
					},
					set: function (callback) {
						if (callback !== null) {
							if (callback instanceof Function) {
								// Remove the current listener before adding the new.
								this.removeEventListener(eventType, listener, false);
								this.addEventListener(eventType, callback);
								listener = callback;
							} else {
								throw new StoreError("TypeError", "declareHandler", "callback is not a callable object");
							}
						} else {
							this.removeEventListener(eventType, listener, false);
							listener = null;
						}
					},
					configurable: true,
					enumerable: true
				});
			} else {
				throw new StoreError("TypeError", "declareHandler", "invalid event type");
			}
		});
		return types;
	};

	EventTarget.removeHandler = function (target, types) {
		types = lib.anyToArray(types);
		types.forEach(function (type) {
			if (lib.isString(type)) {
				var eventType = type.toLowerCase().replace(/^on/, "");
				var property  = "on" + eventType;

				if (target.hasOwnProperty(property)) {
					target.removeEventListener(eventType);
					delete target[property];
				}
			}
		});
	};

	EventTarget.unhandledError = function (event) {
		// summary:
		//		An 'error' event was dispatched but no handler processed it.
		// event:
		//		Synthetic event
		// tag:
		//		protected
		if (unhandled !== false) {
			var target = event.target.toString();
			var error  = event.error;
			var text   = "[Event has no error property]";

			if (error instanceof Error) {
				text = error.toString();
			}
			console.error("Unhandled error event, Target: ", target, "\n", text);
		}
	};

	return EventTarget;
});
