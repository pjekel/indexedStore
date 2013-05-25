//
// Copyright (c) 2012-2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../../_base/Library",
				"../../listener/ListenerList",
				"../../error/createError!../../error/StoreErrors.json",
				"./EventDefaults",
				"./Event"
			], function (Lib, ListenerList, createError, EventDefaults, Event) {
	"use strict";

	// module:
	//		indexedStore/dom/event/EventTarget
	// summary:
	//		Implements the DOM 3/4 EventTarget interface
	//
	//	http://www.w3.org/TR/dom/		(DOM4)
	//	http://www.w3.org/TR/DOM-Level-3-Events/

	var StoreError = createError("EventTarget");		// Create the StoreError type.
	var isString   = Lib.isString;
	
	var nativeEvent = window.Event;
	var PROPERTY = "parentNode";

	function copyEvent( nativeEvent ) {
		// summary:
		//		Copy a native event object converting it to an Event object. Copying
		//		the native event it will unlock all read-only properties.
		// nativeEvent: native Event
		// returns: Event
		//		Instance of an Event object.
		// tag:
		//		Private
		var key, newEvt, orgEvt = nativeEvent;
		try {
			newEvt = new Event();
			for (key in orgEvt) {
				// copy all properties excluding all functions.
				if (typeof orgEvt[key] != "function") {
					newEvt[key] = orgEvt[key];
				}
			}
			Lib.writable( newEvt, "isTrusted, timeStamp", false );
		} catch (err) {
			// Oops, too bad, go fish...
			return null;
		}
		return newEvt;
	}

	function propagate (path, phase, event) {
		// summary:
		//		Iterate the propagation path for the event.
		// path: EventTarget[]
		//		The propagation path which is an array of event targets.
		// phase: Number
		//		Propagation phase. The phase is either CAPTURING_PHASE, AT_TARGET or
		//		BUBBLING_PHASE
		// event: Event
		//		Event to be dispatched.
		// tag:
		//		Private
		var ct, i = 0, e = event;

		while( (ct = path[i++]) && !e.stopPropagate) {
			if (ct instanceof EventTarget) {
				e.currentTarget = ct;
				e.eventPhase = phase;			
				try {
					var lstn = ct.getEventListeners(e.type, phase);
					if (lstn && lstn.length) {
						var l, j = 0;
						while ( (l = lstn[j++]) && !e.stopImmediate) {
							// Make sure the event propagation is not interrupted and that any
							// exceptions thrown inside a handler are caught here.
							try {
								var cb = l.listener || (l.scope || window)[l.bindName];
								if (cb) {
									cb.call( ct, e );
								}
							} catch(err) {
								console.error( err );
								e.error = err;
							}
						}
					}
				} catch (e) {
					// Probably not an instance of EventTarget
					console.error( e );
				} 
			}
		}
		return !e.stopPropagate;
	}

	function validatePath (path, target) {
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
		var path = (path instanceof Array) ? path : [path];
		var validPath = path.filter( function(evtTarget) {
			return ( evtTarget instanceof EventTarget && evtTarget != target);
		});
		return validPath;
	}

	function EventTarget() {
		// summary:
		//		Implements the DOM Level 3/4 EvenTarget interface.
		//		http://www.w3.org/TR/dom/#interface-eventtarget
		// tag:
		//		Public

		// Declare a ListenerList for each event phase..
		var lists = {
			bubbling: new ListenerList(),
			capture: new ListenerList()
		}
		
		Lib.defProp( this, "parentNode", {	enumerable: false, 	writable: true });

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
		}

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
			return eventList.addListener( type, callback );
		};

		this.on = function (/*String*/ type, /*EventListener*/ callback) {
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
			return this.addEventListener (type, callback, false);
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
			eventList.removeListener( type, callback );
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
				if (!event.dispatch && event.eventPhase == Event.NONE) {		
					var parent = this[PROPERTY];
					var result = false;
					var path   = [];

					if (propagationPath) {
						path = validatePath( propagationPath, this );
					} else {
						while (parent) {
							path.unshift(parent);
							parent = parent[PROPERTY];
						}
					}
					event.dispatch = true;
					event.target   = this;

					// Trigger any default actions required BEFORE dispatching
					if (!event.defaultPrevented) {
						EventDefaults.trigger(event.type, "before");
					}
					if (!event.stopPropagate) {
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
						EventDefaults.trigger(event.type, "after");
					} else {
						result = true;
					}
					// Reset the event allowing it to be re-dispatched.
					event.dispatch = false;
					event.initEvent();
					return result;			
				}
				throw new StoreError( "InvalidStateError", "dispatchEvent" );
			} else {
				if (event instanceof nativeEvent) {
					if (event = copyEvent(event)) {
						return this.dispatchEvent( event, propagationPath);
					}
				}
			}
			throw new StoreError( "TypeError", "dispatchEvent", "invalid event");
		};

	} /* end EventTarget() */

	return EventTarget;
});
