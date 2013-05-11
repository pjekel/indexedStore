//
// Copyright (c) 2012-2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["../../error/createError!../../error/StoreErrors.json",
				"../../util/shim/Array"
			 ], function (createError) {

// module:
//
//	http://www.w3.org/TR/DOM-Level-3-Events/

	var StoreError = createError("EventDefault");		// Create the StoreError type.
	var eventActions = {};

	function ActionList () {
		this.before = [];
		this.after  = [];
	}

	function addAction (aspect, type, action, scope /*[, arg1[, arg2[, ...]]]*/ )  {
		// summary:
		//		Associate a default action with an event type. The default action can be
		//		triggered either 'before' or 'after' the event is dispatched depending
		//		on the aspect parameter.
		// aspect: String
		//		Identifies when the default action is called, that is, either 'before'
		//		or 'after' the event is dispatched.
		// type: String
		//		Specifies the event type for which a default action is being registered.
		// action: Function
		//		The function called as the default action for the event type. The action
		//		is called as:
		//
		//				action( event [, arg1[, arg2[, ...]]]);
		//
		//		the optional arguments is the variable list of arguments following the
		//		scope parameter.
		// scope: Object?
		//		The scope to use when calling the default action. When specified the
		//		'this' object for the action routine will be the scope.
		// tag:
		//		Private

		if (type instanceof String || typeof type == "string") {
			if (/,/.test(type)) {
				// Type is a comma separated string...
				var args  = Array.prototype.slice.call(arguments);
				var types = type.split(/\s*,\s*/);
				types.forEach( function (type) {
					args[1] = type;
					addAction.apply(this, args);
				}, this );
				return;
			}

			if (typeof action === "function") {
				var optinalArgs = Array.prototype.slice.call(arguments,4);
				var actionList  = eventActions[type] || new ActionList();
				var actionDef   = { action: action, scope: scope, args: optinalArgs };

				actionList[aspect].push(actionDef);
				eventActions[type] = actionList;
			} else {
				throw new StoreError( "Parameter", "addAction", "action is not a callable object" );
			}
		} else {
			throw new StoreError( "Parameter", "addAction", "type is missing or not a string" );
		}
	}

	var action = {

		after: function (type, action, scope) {
			// summary:
			// type: String
			// action: Function
			// scope: Object?
			// tag:
			//		Public
			var args = Array.prototype.slice.call(arguments, 0);
			args.unshift("after");
			addAction.apply( this, args );
		},

		before: function (type, action, scope) {
			// summary:
			// type: String
			// action: Function
			// scope: Object?
			// tag:
			//		Public
			var args = Array.prototype.slice.call(arguments, 0);
			args.unshift("before");
			addAction.apply( this, args );
		},

		clear: function (type) {
			// summary:
			//		Clear the default action(s) associated with an event type.
			// type: String?
			//		Event type, if specified the default action for the given event
			//		type are removed. If ommitted, all default actions are removed.
			// tag:
			//		Public
			if (type) {
				if (type instanceof String || typeof type == "string") {
					if (/,/.test(type)) {
						// Type is a comma separated string...
						var args  = Array.prototype.slice.call(arguments);
						var types = type.split(/\s*,\s*/);
						types.forEach( function (type) {
							this.clear(type);
						}, this);
						return;
					}
					delete eventActions[type];
				} else {
					throw new StoreError( "Parameter", "clear", "type is missing or not a string" );
				}
			} else {
				eventActions = {};
			}
		},

		has: function (type, aspect) {
			// summary:
			// type: String
			// aspect: String?
			// tag:
			//		Public
			var actions = eventActions[type];
			var total = 0;
			if (actions) {
				total = actions.before.length + actions.after.length;
				if (aspect) {
					if (actions = actions[aspect]) {
						total = actions.length;
					} else {
						total = 0;
					}
				}
			}
			return !!total;
		},
		
		trigger: function (event, aspect) {
			// summary:
			//		Trigger all registered default actions associated with a specific
			//		event type. If an action callback invokes event.preventDefault()
			//		all remaining action callbacks will be skipped.
			// event: Event
			//		The event for which the default action(s) are triggered. The event
			//		itself is passed to the action callback as the first argument.
			// aspect: String
			//		The aspect determines which action type is triggered, 'before' or 
			//		'after'.
			// tag:
			//		Public

			var actionList = eventActions[event.type];
			var actionArgs;

			if (actionList) {
				actionList[aspect].some( function (action) {
					try {
						actionArgs = action.args.slice();
						actionArgs.unshift(event);
						action.action.apply( (action.scope || event.target), actionArgs );
					} catch(err) {
						event.error = err;
					}
					return event.defaultPrevented;
				});
			}
		}
	}

	return action;

});
