//
// Copyright (c) 2013, Peter Jekel
// All rights reserved.
//
//	The IndexedStore is released under to following two licenses:
//
//	1 - The "New" BSD License				(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License		(http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//

define([], function(){

	// module:
	//		store/_base/Record

	function Record(key, value, revision) {
		// summary:
		//		Definition of an IndexedDB record.
		// key: Key
		//		The key by which the record can be retrieved. Please refer to:
		//		http://www.w3.org/TR/IndexedDB/#key-construct for the definition
		//		of valid keys.
		// value: Object
		//		Record value (a JavaScript key:value pairs object).
		// revision: Number?
		// returns: Record
		//		A new instance of a Record object.
		// tag:
		//		Public
		this.key   = key;
		this.rev   = revision || 0;
		this.value = value;
	}
	
	Record.prototype.destroy = function () {
		this._destroyed = true;	
	}
	
	return Record;
});
