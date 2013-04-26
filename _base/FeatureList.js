//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define (["./Library"], function (Lib) {
	"use strict";

	var defProp = Lib.defProp;
	
	function FeatureList() {
		// summary:
		// tag:
		//		Public

		var features = {};
		var length   = 0;

		//=========================================================================
		// Helper functions
		
		defProp( this, "toSource", {
			value: function  () { return features; },
			enumerable: false
		});
		
		//=========================================================================
		// Public properties and methods

		defProp( this, "length", {
			get: function () {
				return length;
			},
			enumerable: true
		});
		defProp( this, "features", {
			get: function () {
				var keys = Object.keys(features).sort();
				return keys.toString();
			},
			enumerable: true
		});

		this.add = function (/*String*/ name, /*any*/ value) {
			if (typeof name == "string") {
				if (!(name in features)) {
					length++;
				}
				features[name] = value || true;
			}
			return false;
		};
		
		this.has = function(/*String|String[]*/ name,/*Boolean?*/ all ) {
			// summary:
			//		Returns true if a given string is part of the DOMStringList otherwise
			//		false
			// name:
			//		A feature name, a comma separated list of feature names or an array
			//		of feature names.
			// all:
			// tag:
			//		Public
			if (name instanceof Array) {
				return (all ? name.every( this.has ) : name.some( this.has ));
			} else if (/,/.test(name)) {
				return this.has( name.split(/\s*,\s*/));
			}
			return features[name] || false;
		};

		this.remove = function(/*String*/ name ) {
			// summary:
			//		Returns true if a given string is part of the DOMStringList otherwise
			//		false
			// tag:
			//		Public
			if (name in features) {
				delete features[name];
				length--;
			}
		};

		if (arguments.length > 0) {
			var feat = Array.prototype.slice.call(arguments);
			feat.forEach( this.add, this );
		}
		Object.seal(this);
	}

	return FeatureList;
});
