//
// Copyright (c) 2012-2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["./Listener",
				"./ListenerList",
				"../_base/Library",
				"../error/createError!../error/StoreErrors.json"
			 ], function (Listener, ListenerList, Lib, createError) {
	"use strict";
	
	// module:
	//		indexedStore/listener/Actions
	// summary:
	//		Actions is a container object to organize listeners by aspect and type.
	//		Actions objects are typically associated with one or more ListenerList
	//		and as such manage default actions for those list.
	// example:
	//	|	var myActions = new Actions();
	//	|	var myList    = new ListenerList( myActions );
	//	|	myList.addListener( "bingo", callback );
	//	| myList.actions.before( "bingo", beforeBingo );
	//	| myList.actions.after( "bingo", afterBingo );
	//	|                ...
	//	|	myList.trigger( "bingo" );
	
	
	var StoreError = createError("Actions");	// Create the StoreError type.
	var C_DEFAULTS = ["after", "before"];			// default aspects
	var isString   = Lib.isString;
	
	function Actions ( aspects ) {
		// summary:
		//		Create a new instance of Actions.
		// aspects: String?
		//		Optional aspect types. If specified, a method is addded to the actions
		//		object for each aspect. User specified aspects are in addition to the
		//		default aspects 'before' and 'after'.
		// returns:
		//		An Actions object with a dedicated method for each aspect to register
		//		actions. If no user aspects are specified the object will have the
		//		following methods: addToList, after, before, removeAction and trigger.
		// tag:
		//		Public
		
		function addAction (aspect, type, action, scope) {
			// summary:
			//		Associate a action with a type and aspect.
			// aspect: String
			// type: String
			//		Specifies the type for which a action is being registered.
			// action: Function
			//		The function called as the action for the type and aspect.
			//		The action is called as:
			//
			//				action( type [, arg1[, arg2, ..., argN]]);
			//
			//		the optional arguments is the variable list of arguments following
			//		the scope parameter.
			// scope: Object?
			//		The scope to use when calling the action. When specified the 'this'
			//		object for the action routine will be the scope.
			// returns:
			//		An object which has a remove method which can be called to remove
			//		the action from the ListenerList.
			// tag:
			//		Private

			if (isString(type)) {
				var args   = Array.prototype.slice.call(arguments,2);
				var action = Listener.apply(new Listener(), args);
				return actionList[aspect].addListener( type, action );
			} else {
				throw new StoreError( "Parameter", "addAction", "type is missing or not a string" );
			}
		}

		this.removeAction = function (type, aspect) {
			// summary:
			//		Remove an action
			// type: String|String[]?
			//		Type(s) of action(s) to be removed. If omitted all actions for the
			//		given aspect are removed.
			// aspect: String|String[]?
			//		Aspect(s) from which the action is removed. If omitted, the action
			//		for the given type is removed from all aspects.
			// tag:
			//		Public
			if (aspect) {
				if (aspect instanceof Array) {
					aspect.forEach( function (aspect) {
						self.removeAction(type, aspect);
					});
				} else if (isString(aspect)) {
					if (/,/.test(aspect)) {
						self.removeAction(type, aspect.split(/\s*,\s*/) );
					} else {
						var list = isString(aspect) && actionList[aspect.toLowerCase()];
						if (list && list.length) {
							list.removeListener(type);
						}
					}
				} else {
					throw new StoreError("Parameter", "clear", "invalid aspect argument");
				}
			} else {
				self.removeAction( type, Object.keys(actionList) );
			}
		};

		this.trigger = function (type, aspect) {
			// summary:
			//		Trigger all registered actions associated with a specific type and
			//		aspect.
			// type: String
			//		Action or event type.
			// aspect: String
			// tag:
			//		Public
			var list = actionList[aspect];
			if (list && list.length) {
				var args = Array.prototype.slice.call(arguments,2);
				args.unshift(type);
				list.trigger.apply(list, args);
			}
		};

		var actionList = {};
		var reserved   = Object.keys(this);
		var self       = this;

		if (aspects) {
			if (isString(aspects)) {
				aspects = /,/.test(aspects) ? aspects.split( /\s*,\s*/ ) : [aspects];
			} else {
				throw new StoreError( "Parameter", "constructor", "aspects argument must be a string" );
			}
		}
		// Merge custom aspects with the defaults and create the appropriate methods
		// and ListenerLists...
		aspects = aspects ? C_DEFAULTS.concat( aspects ) : C_DEFAULTS;
		aspects.forEach( function (aspect) {
			if (reserved.indexOf(aspect) == -1) {
				actionList[aspect] = new ListenerList();
				// Create a method for the aspect
				this[aspect] = function (type, action, scope) {
					var args = Array.prototype.slice.call(arguments);
					args.unshift(aspect);
					return addAction.apply( this, args );
				};
			} else {
				throw new StoreError( "Parameter", "constructor", "[%{0}] is a reserved keyword", aspect );
			}
		}, this);

	}
	
	return Actions;
});
