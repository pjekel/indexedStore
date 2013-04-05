//
// Copyright (c) 2012, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define(["dojo/_base/lang",
				"../../error/createError!../../error/StoreErrors.json"
			 ], function(lang, createError){

// module:
//		indexedDB/Event
//
//	http://www.w3.org/TR/dom/		(DOM4)
//	http://www.w3.org/TR/DOM-Level-3-Events/

	var defineProperty = Object.defineProperty;
	var StoreError = createError("Event");		// Create the StoreError type.
	var EVENT_INIT = { bubbles: false, cancelable: false, detail: null };

	function setEventType( event, type ) {
		if (typeof type === "string") {
			event.type = type;
		}  else {
			throw new StoreError( "TypeError", "setEventType", "invalid event type");
		}
	}

	function Event (/*String*/ type, /*object?*/ properties) {
		// summary:
		//		Implements a DOM level 3 event
		// type:
		//		Event type.
		// properties:
		// tag:
		//		Public

		this.currentTarget    = null;
		this.target           = null;
		this.bubbles          = false;
		this.cancelable       = false;
		this.timestamp        = new Date();
		this.eventPhase       = 0;
		this.isTrusted        = false;				// False by default...
		this.dispatch         = false;
		this.type             = "";
		this.defaultPrevented = false;
		this.detail           = null;

		defineProperty (this, "date", {writable:false});
		defineProperty (this, "isTrusted", {writable:false});

		this.dispatch = function (/*EventTarget*/ target, /*EventTargets[]?*/ propagationPath) {
			// summary:
			//		Dispatch an event at a specific event target. If the target parameter
			//		is omitted the current target of the event ('this') is used. The event
			//		target MUST have a DOM Level 3 style dispatchEvent method.
			// target:
			//		The event target.
			// propagationPath:
			//		The event propagation path.
			//
			// NOTE:
			//		This method is not part of the DOM specification and provided for
			//		convenience only to allow:
			//
			//			new Event("myType").dispatch(target);
			//
			// tag:
			//		Public
			var target = target || this.target;

			if (target) {
				// Make sure the target has an event dispatcher.
				if (target.dispatchEvent) {
					target.dispatchEvent( this, propagationPath );
				} else {
					throw new StoreError("MethodMissing", "dispatch", "Event target has no event dispatcher.");
				}
			} else {
				throw new StoreError( "Parameter", "dispatch", "no target for event");
			}
		}

		this.initEvent = function (type, bubbles, cancelable, detail) {
			// summary:
			//		For legacy support only (use event properties instead).
			// type:
			//		Specifies Event.type, the name of the event type.
			// bubbles:
			//		Specifies Event.bubbles. This parameter overrides the intrinsic
			//		bubbling behavior of the event.
			// cancelable:
			//		Specifies Event.cancelable. This parameter overrides the intrinsic
			//		cancelable behavior of the event.
			// tag:
			//		Public
			if (!this.eventPhase) {
				this.cancelable = (cancelable !== undefined ? !!cancelable : this.cancelable);
				this.bubbles    = (bubbles    !== undefined ? !!bubbles    : this.bubbles);
				if (type) {
					setEventType(this, type);
				}
				this.defaultPrevented = false;
				this.detail = detail || null;
				delete this.stopImmediate;
				delete this.stopDeferred;
				delete this.stopped;
			}
		}

		this.preventDefault = function () {
			// summary:
			//		When this method is invoked, the event must be canceled, meaning any
			//		default actions normally taken by the implementation as a result of
			//		the event must not occur.
			//
			// 		Note: This method does not stop the event propagation.
			// tag:
			//		Public
			if (this.cancelable) {
				this.defaultPrevented = true;
				this.cancelable = false;
			}
		}

		this.stopImmediatePropagation = function () {
			// summary:
			//		Prevents all other event listeners from being triggered for this event
			//		dispatch, including any remaining candiate event listeners.
			// tag:
			//		Public
			this.stopImmediate = true;
			this.stopped       = true;
		}

		this.stopPropagation = function () {
			// summary:
			//		Prevents all other event listeners from being triggered, excluding any
			//		remaining candiate event listeners.
			// tag:
			//		Public
			this.stopDeferred = true;
			this.stopped      = true;
		}

		lang.mixin( this, properties);
		if (type) {
			setEventType( this, type );
		}
		defineProperty (this, "detail", {writable:false});
	}
	return Event;
});
