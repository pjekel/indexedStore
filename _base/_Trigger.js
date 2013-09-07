//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["dojo/_base/declare",
		"./library",
		"./opcodes",
		"../dom/event/Event",
		"../listener/ListenerList",
		], function (declare, lib, opcodes, Event, ListenerList) {
	"use strict";
	// module:
	//		indexedStore/_base/_Trigger
	// summary:
	//		Encapsulate the store's core trigger mechanism (internal use only).
	// description:
	//		Exposes the store's core trigger mechanism. Triggers are much like
	//		events however without the overhead associated with events.
	//		For example, triggers do not use event like objects instead, they
	//		directly invoke listeners with a trigger type and a variable list
	//		of arguments.  Also, triggers do not have a propagation path like
	//		events may have nor can they be canceled or stopped.
	// NOTE:
	//		The store trigger mechanism is reserved for internal use only, user
	//		application should use the standard DOM-4 style event mechanism or
	//		store extensions, such as Observable or Watch, to get notified of
	//		store mutations.
	//
	// interface:
	//		_Trigger interface {
	//			void	_notify();
	//			handle	_register();
	//			void	_trigger();
	//		};
	var _Trigger = declare(null, {

		//===================================================================
		// constructor

		constructor: function () {
			this._listeners = new ListenerList();
		},

		//===================================================================
		// protected methods

		_notify: function (opType, key, newVal, oldVal, at, options, flags) {
			// summary:
			//		Notify registered listeners of a store mutation. This method
			//		is called directly from a storage procedure or a transaction
			//		commit procedure.
			//		If the store is eventable and events aren't currently being
			//		suppressed an event with the symbolic name of opType set as
			//		its type is emitted in addition to the trigger.
			// opType:
			//		Operation type (see indexedStore/_base/opcodes)
			// key: Key
			//		Record key.
			// newVal: any
			//		The new record value property value.
			// oldVal: any
			//		The old record value property value.
			// at: Number?
			//		Record index number
			// options: Object?
			//		Operation directives
			// flags: Object?
			//		Optional record flags.
			// tag:
			//		protected

			var vargs   = Array.prototype.slice.call(arguments);
			var opName  = opcodes.name(opType).toLowerCase();
			var event, detail = null;

			// Guarantee that listeners can rely on the fact there always is an
			// options and flags argument available in case they want to use or
			// extend them.

			vargs[5] = options || {};
			vargs[6] = flags || {};

			try {
				this._listeners.trigger.apply(this, vargs);
				if (this.eventable && !this.suppressEvents) {
					switch (opType) {
						case opcodes.NEW:
						case opcodes.UPDATE:
							detail = lib.mixin({item: newVal}, (oldVal ? {oldItem: oldVal} : null));
							break;
						case opcodes.DELETE:
							detail = {item: oldVal};
							break;
						case opcodes.CLEAR:
						case opcodes.CLOSE:
							break;
					}
					event = detail ? new Event(opName, {detail: detail}) : new Event(opName);
					this.dispatchEvent(event);
				}
			} catch (err) {
				event = new Event("error", {error: err, bubbles: true, cancelable: true});
				this.dispatchEvent(event);
			}
		},

		_register: function (trigger, listener, scope, priority) {
			// summary:
			//		Register a listener (callback) with the store. Registering
			//		callbacks with the store is reserved for store modules and
			//		extension only.
			// trigger: String|String[]
			//		Store trigger to register for. The trigger argument can also
			//		be a comma separated string of trigger names.
			// listener: Listener|Function
			//		The listener that is called when the store trigger occurs.
			// scope: Object?
			//		The object use as 'this' in the listener body.
			// priority: Number?
			//		Determines the order in which listeners for the same trigger
			//		type are invoked. See indexedStore/listener/ListenerList for
			//		additional information
			// tag:
			//		protected
			return this._listeners.addListener(trigger, listener, scope, priority);
		},

		_trigger: function (trigger /* [, arg0 [, arg1, ... , argN]] */) {
			// summary:
			//		Invoke the registered listeners for the given trigger. This
			//		method should be used for all non-opcode type triggers.
			//		For example, store loaders call this method to notify other
			//		modules and extensions of any store loading related events.
			// trigger: String
			//		See _register()
			// tag:
			//		protected
			this._listeners.trigger.apply(this, arguments);
		}
	});

	return _Trigger;
});	/* end define() */
