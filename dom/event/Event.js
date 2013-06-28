//
// Copyright (c) 2012-2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../../_base/library"], function (lib) {
	"use strict";

	// module:
	//		indexedStore/dom/event/Event
	//
	//	http://www.w3.org/TR/dom/		(DOM4)
	//	http://www.w3.org/TR/DOM-Level-3-Events/

	var flags = ["dispatch", "stopImmediate", "stopPropagate"];

	var isObject = lib.isObject;
	var isString = lib.isString;
	var isEmpty  = lib.isEmpty;
	var defProp  = lib.defProp;
	var mixin    = lib.mixin;

	var NativeEvent = window.Event;

	function mixinEvent(newEvt, orgEvt) {
		// summary:
		//		Mixin a synthetic or native event with a new synthetic event.
		// newEvt: SyntheticEvent
		// orgEvt: SyntheticEvent|NativeEvent
		// returns: SyntheticEvent
		// tag:
		//		private
		var key;
		for (key in orgEvt) {
			if (typeof orgEvt[key] != "function") {
				newEvt[key] = orgEvt[key];
			}
		}
		return newEvt;
	}

	function setEventType(event, type) {
		// summary:
		//		Validate and set the event type.
		// event: Event
		// type: String
		// tag:
		//		Private
		if (isString(type)) {
			defProp(event, "type", {value: type, enumerable: true, writable: false});
		} else {
			throw new TypeError("invalid event type");
		}
	}

	function SyntheticEvent(type, properties) {
		// summary:
		//		Implements a DOM level 4 event
		// type: String
		//		Event type.
		// properties: Object?
		// tag:
		//		Public

		if (this == null) {
			throw new TypeError("SytheticEvent constructor cannot be called as a function");
		}
		// Public properties
		this.type             = "";
		this.target           = null;
		this.currentTarget    = null;
		this.eventPhase       = SyntheticEvent.NONE;
		this.bubbles          = false;
		this.cancelable       = false;
		this.defaultPrevented = false;
		this.isTrusted        = false;				// False by default...
		this.timeStamp        = Date.now();

		this.initEvent = function (type, bubbles, cancelable, detail) {
			// summary:
			//		For legacy support only (use event properties instead).
			// type: String?
			//		Specifies Event.type, the name of the event type.
			// bubbles: Boolean?
			//		Specifies Event.bubbles. This parameter overrides the intrinsic
			//		bubbling behavior of the event.
			// cancelable: Boolean?
			//		Specifies Event.cancelable. This parameter overrides the intrinsic
			//		cancelable behavior of the event.
			// detail: Object?
			//		Event details in case of a custom event.
			// tag:
			//		Public
			if (!this.dispatch) {
				this.cancelable = (cancelable !== undefined ? !!cancelable : this.cancelable);
				this.bubbles    = (bubbles    !== undefined ? !!bubbles    : this.bubbles);

				setEventType(this, (type || this.type));

				if (detail && isObject(detail) && !isEmpty(detail)) {
					this.detail = detail;
				}
				this.target           = null;
				this.currentTarget    = null;
				this.eventPhase       = SyntheticEvent.NONE;
				this.defaultPrevented = false;
				this.stopImmediate    = false;
				this.stopPropagate    = false;
			}
		};

		this.preventDefault = function () {
			// summary:
			//		When this method is invoked, the event must be canceled, meaning any
			//		default actions normally taken by the implementation as a result of
			//		the event must not occur.
			//
			//		Note: This method does not stop the event propagation.
			// tag:
			//		Public
			if (this.cancelable) {
				this.defaultPrevented = true;
			}
		};

		this.stopImmediatePropagation = function () {
			// summary:
			//		Prevents all other event listeners from being triggered for this event
			//		dispatch, including any remaining candiate event listeners.
			// tag:
			//		Public
			this.stopPropagate = true;
			this.stopImmediate = true;
		};

		this.stopPropagation = function () {
			// summary:
			//		Prevents all other event listeners from being triggered, excluding any
			//		remaining candiate event listeners.
			// tag:
			//		Public
			this.stopPropagate = true;
		};

		// Add and hide protected flags
		flags.forEach(function (flag) {
			defProp(this, flag, {value: false, writable: true});
		}, this);

		if (arguments.length) {
			var evtType = type;
			// allow for copying an event: (e.g. new sytheticEvent(event))
			if (type instanceof SyntheticEvent || (NativeEvent && type instanceof NativeEvent)) {
				mixinEvent(this, type);
				evtType = type.type;
			}
			mixin(this, properties);
			setEventType(this, evtType);
			lib.writable(this, "type, isTrusted, timeStamp", false);
		}
		return this;
	}	/* end SyntheticEvent() */

	// Event phases...
	SyntheticEvent.NONE            = 0;
	SyntheticEvent.CAPTURING_PHASE = 1;
	SyntheticEvent.AT_TARGET       = 2;
	SyntheticEvent.BUBBLING_PHASE  = 3;

	return SyntheticEvent;
});
