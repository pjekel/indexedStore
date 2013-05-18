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
				"../../error/createError!../../error/StoreErrors.json",
				"../../util/shim/Date"		// Date.now()
			 ], function(Lib, createError){
	"use strict";
	
	// module:
	//		indexedStore/dom/event/Event
	//
	//	http://www.w3.org/TR/dom/		(DOM4)
	//	http://www.w3.org/TR/DOM-Level-3-Events/

	var StoreError = createError("Event");		// Create the StoreError type.

	var EVENT_FLAGS = ["dispatch", "stopDeferred", "stopImmediate", "stopPropagate"];
	var EVENT_INIT  = { bubbles: false, cancelable: false, detail: null };

	var isObject = Lib.isObject;
	var isEmpty  = Lib.isEmpty;
	var isString = Lib.isString;
	var mixin    = Lib.mixin; 
	
	var NONE            = 0,
			CAPTURING_PHASE = 1,
			AT_TARGET       = 2,
			BUBBLING_PHASE  = 3;

	function setEventType( event, type ) {
		// summary:
		//		Validate and set the event type.
		// event: Event
		// type: String
		// tag:
		//		Private
		if (isString(type)) {
			event.type = type;
			return type;
		}  else {
			throw new StoreError( "TypeError", "setEventType", "invalid event type");
		}
	}

	function Event (type, properties) {
		// summary:
		//		Implements a DOM level 4 event
		// type: String
		//		Event type.
		// properties: Object?
		// tag:
		//		Public

		// allow for copying an event: (e.g. new Event(event) )
		if (type instanceof Event) {
			return mixin(this,type);
		}

		// Public properties
		this.currentTarget    = null;
		this.target           = null;
		this.bubbles          = false;
		this.cancelable       = false;
		this.timeStamp        = Date.now();
		this.eventPhase       = NONE;
		this.isTrusted        = false;				// False by default...
		this.type             = "";
		this.defaultPrevented = false;

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
				this.type       = type ? setEventType(this, type) : this.type;

				if (detail && isObject(detail) && !isEmpty(detail)) {
					this.detail = detail;
				}
				this.currentTarget    = null;
				this.defaultPrevented = false;
				this.eventPhase       = NONE;
				this.stopDeferred     = false;
				this.stopImmediate    = false;
				this.stopPropagate    = false;
				this.target           = null;
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
			}
		}

		this.stopImmediatePropagation = function () {
			// summary:
			//		Prevents all other event listeners from being triggered for this event
			//		dispatch, including any remaining candiate event listeners.
			// tag:
			//		Public
			this.stopPropagate = true;
			this.stopImmediate = true;
		}

		this.stopPropagation = function () {
			// summary:
			//		Prevents all other event listeners from being triggered, excluding any
			//		remaining candiate event listeners.
			// tag:
			//		Public
			this.stopPropagate = true;
			this.stopDeferred  = true;
		}

		// Add private flags
		EVENT_FLAGS.forEach( function (flag) {
			Lib.defProp( this, flag, {value:false, enumerable: false, writable:true});
		}, this);

		if (arguments.length) {
			mixin( this, properties);
			this.type = type ? setEventType( this, type ) : "";

			Lib.writable( this, "isTrusted, timeStamp", false );
		}
	}
	
	return Event;
});
