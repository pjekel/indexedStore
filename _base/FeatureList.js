//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define(["./library"], function (lib) {
	"use strict";

	var defProp = lib.defProp;

	function FeatureList() {
		// summary:
		// tag:
		//		Public

		//=========================================================================
		// Public properties

		defProp(this, "length", { get: function () { return length;	}, enumerable: true});
		defProp(this, "features", {
			get: function () {
				return Object.keys(features).sort();
			},
			enumerable: true
		});

		//=========================================================================
		// Public methods

		this.add = function (name, value) {
			// summary:
			// name: String
			// value: any
			// tag:
			//		public
			var names = lib.anyToArray(name);
			names.forEach(function (name) {
				if (typeof name == "string") {
					if (!(features.hasOwnProperty(name))) {
						length++;
					}
					features[name] = value || true;
				}
			});
			return false;
		};

		this.has = function (name, all) {
			// summary:
			//		Returns true or the value for a given name if the name is
			//		part of the FeatureList otherwise false
			// name: String|String[]
			//		A feature name, a comma separated list of feature names or
			//		an array of feature names.
			// all: Boolean?
			// tag:
			//		Public
			if (name instanceof Array) {
				return (all ? name.every(this.has) : name.some(this.has));
			} else if (/,/.test(name)) {
				return this.has(name.split(/\s*,\s*/), all);
			} else if (name instanceof RegExp) {
				var keys = Object.keys(features);
				return keys.some( function (key) {
					return name.test(key);
				});
			}
			return features[name] || false;
		};

		this.remove = function (name) {
			// summary:
			//		Returns true if a given string is part of the DOMStringList otherwise
			//		false
			// name: String
			// tag:
			//		Public
			var names = lib.anyToArray(name);
			names.forEach(function (name) {
				if (features.hasOwnProperty(name)) {
					delete features[name];
					length--;
				}
			});
		};

		var features = {};
		var length   = 0;

		if (arguments.length > 0) {
			var feat = Array.prototype.slice.call(arguments);
			feat.forEach(this.add, this);
		}
		Object.seal(this);
	}

	return FeatureList;
});
