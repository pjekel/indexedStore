define(["dojo/_base/declare",
				"../error/createError!../error/StoreErrors.json"
			 ], function (declare, createError) {

	// module:
	//		/store/api/Store
	// summary:

	var StoreError = createError("API");		// Create the StoreError type.

	var Store = declare( null, {
		// summary:
		//		This API defines method signatures ONLY without providing implementation
		//		details. All methods and properties defined in this API are optional and
		//		require implemention only if the store is to offer the functionality.
		//
		//		Except for hasChildren() and isItem(), every method, whose return value
		//		isn't already a promise or void, must return a promise for the specified
		//		return value if the execution of the method is asynchronous.
		//		Whenever a promise is returned the following conditions must be met:
		//
		//			1 - On successful completion of the method the promise must resolve
		//					with the specified synchronous return value as its result.
		//			2 - On exception, the promise is rejected with the error condition
		//					as its result.
		//
		//		In the context of this API, data types are defined as follows:
		//
		//		- Object		A JavaScript key:value pairs object (hash).
		//		- Boolean		A JavaScript Boolean (true or false)
		//		- Date			A JavaScript Date object.
		//		- Key				A String, Date or Number, or an Array of formentioned types.
		//		- KeyPath		The empty string, a JavaScript identifier, or multiple
		//								Javascript identifiers separated by periods.
		//		- KeyRange	A continuous interval over some data type used for keys. 
		//		- Record		A JavaScript key:value pairs object with two properties: 
		//								key and value.
		//		- String		A JavaScript String
		//		- Number		A JavaScript Number
		//		- void			undefined

		//=========================================================================
		// Store Properties

		// autoIncrement: Boolean
		//		Indicates if the store supports a key generator. A key generator keeps
		//		an internal current number. The current number is always a positive
		//		integer. (See http://www.w3.org/TR/IndexedDB/#key-generator-concept
		//		for additional information).
		autoIncrement: false,
		
		// clearOnClose: Boolean
		//		If true, the store content will be deleted when the store is closed.
		clearOnClose: false,
		
		// defaultProperties: Object
		//		A JavaScript key:values pairs object whose properties and associated
		//		values are added to new store objects if such properties are missing
		//		from the new store object.
		defaultProperties: null,

		// features: FeatureList 
		//		Feature list object. Contains a list of features currently supported
		//		by the store. 
		features: null,
		
		// idProperty: String
		//		Provided for dojo/store compatibility only, use keyPath instead.
		//		The property name to use as the object identity property. The value of
		//		this property should be unique. If the object being added to the store
		//		does NOT have this property it will be added to the object.
		idProperty: "id",

		// keyPath: String|String[]
		//		A key path is a DOMString that defines how to extract a key from an
		//		object. A valid key path is either the empty string, a JavaScript
		//		identifier, or multiple Javascript identifiers separated by periods (.)
		//		(Note that spaces are not allowed within a key path.)
		//		In addition, the keyPath property can also be an array of key paths.
		keyPath: null,

		// name: String?
		//		Name of the store. If omitted, one will be generated however, if you
		//		elect to use transactions it is recommended to provide a unique name
		//		for each store.
		name: "",
		
		// queryEngine: Function
		//		Defines the query engine to use for querying the data store
		queryEngine: QueryEngine,

		// suppressEvents:
		//		Suppress the dispatching of events. Under certain circumstances it
		//		may be desirable to to suppress the delivery of events until, for
		//		example, after a load request has finished. 
		suppressEvents: false,

		// transaction: Transaction
		//		The transaction the store belongs to.
		transaction: null,
		
		//=========================================================================
		// Store Methods

		add: function (/*Object*/ object,/*PutDirectives?*/ options) {
			// summary:
			//		Add an object to the store, A StoreError of type ConstraintError
			//		is thrown if the object already exists.
			// object:
			//		The object to be added.
			// options:
			//		Additional metadata for storing the data.	Includes an "key" or "id"
			//		property if a specific key is to be used. (See PutDirectives).
			// returns:
			//		Key
			// tag:
			//		Public
		},

		clear: function () {
			// summary:
			//		Clear all records from the the store and associated indexes.
			// tag:
			//		Public
		},

		close: function (/*Boolean?*/ clear) {
			// summary:
			//		Closes the store and optionally clear it. Note: this method has no
			//		effect if the store isn't cleared.
			// clear:
			//		If true, the store is reset. If not specified the store property
			//		'clearOnClose' is used instead.
			// tag:
			//		Public
		},

		count: function (/*Key|KeyRange?*/ key) {
			// summary:
			//		Count the total number of objects that share the key or key range.
			//		If the optional key parameter is not a valid key or a key range,
			//		this method throws a StoreError of type DataError.
			// key:
			//		Key identifying the record to be retrieved. The key arguments can
			//		also be an KeyRange.
			// returns:
			//		Total number of records matching the key or key range. If the key
			//		argument is omitted the total number of records in the store is
			//		returned.
			// tag:
			//		Public
		},

		createIndex: function (/*String*/ name,/*KeyPath*/ keyPath, /*Object?*/ options ) {
			// summary:
			//		Create and returns a new index with the given name and parameters.
			//		If an index with the same name already exists, a StoreError of type
			//		ContraintError is thrown.
			// name:
			//		The name of a new index.
			// keyPath:
			//		The key path used by the new index.
			// options:
			//		The options object whose attributes are optional parameters to this
			//		function. 'unique' specifies whether the index's unique flag is set.
			//		'multiEntry' specifies whether the index's multiEntry flag is set.
			// returns:
			//		An store Index object.
			// tag:
			//		Public
		},

		deleteIndex: function (/*DOMString*/ name) {
			// summary:
			//		Destroys the index with the given name. If there is no index with
			//		the given name a StoreError of type NotFoundError is thrown.
			// name:
			//		The name of an existing index.
			// tag:
			//		Public
		},

		destroy: function () {
			// summary:
			//		Release all memory and mark store as destroyed.
			// tag:
			//		Public
			this._destroyed = true;
			this._clearRecords();
		},

		get: function (/*Key*/ key) {
			// summary:
			//		Retrieves an object by its key
			// key:
			//		The key or key range used to lookup the object. If key is a key
			//		range the first object in range is returned.
			// returns:
			//		The object in the store that matches the given key otherwise void.
			// tag:
			//		Public
			var record = this._retrieveRecord(key).record;
			if (record) {
				return (this._clone ? clone(record.value) : record.value);
			}
		},

		getIdentity: function (/*Object*/ object) {
			// summary:
			//		Returns an object's identity (key).  Note that the key returned
			//		may not be a valid key!
			// object:
			//		The object to get the identity from
			// returns:
			//		Key value.
			// tag:
			//		Public
		},

		index: function (name){
			// summary:
			//		Returns an Index object representing an index that is part of the
			//		store.
			// name:
			//		The name of an existing index.
			// returns:
			//		An Index object if the index exists otherwise void.
			// tag:
			//		Public
		},

		openCursor: function (/*any*/ range, /*DOMString*/ direction) {
			// summary:
			//		Open a new cursor. A cursor is a transient mechanism used to iterate
			//		over multiple records in the store.
			// range:
			//		The key range to use as the cursor's range.
			// direction:
			//		The cursor's required direction. Possible directions are: 'next'
			//		'nextunique', 'prev' and 'prevunique'
			// returns:
			//		A cursorWithValue object.
			// example:
			//		| var cursor = store.openCursor();
			//		| while( cursor && cursor.value ) {
			//		|       ...
			//		|     cursor.continue();
			//		| };
			// tag:
			//		Public
		},

		put: function (/*Object*/ object,/*PutDirectives?*/ options) {
			// summary:
			//		Stores an object. A StoreError of type ConstraintError is thrown if
			//		the object already exists and the overwrite flag is set to false.
			// object:
			//		The object to store.
			// options:
			//		Additional metadata for storing the object. (See PutDirectives)
			// returns:
			//		String or Number
			// tag:
			//		Public
		},

		query: function (/*Object*/ query,/*QueryOptions?*/ options) {
			// summary:
			//		Queries the store for objects.
			// query: Object
			//		The query to use for retrieving objects from the store.
			// options:
			//		The optional arguments to apply to the resultset.
			// returns: dojo/store/api/Store.QueryResults
			//		The results of the query, extended with iterative methods.
			// tag:
			//		Public
		},

		ready: function (/*Function?*/ callback,/*Function?*/ errback, /*Function*/ progress, 
											/*thisArg*/ scope) {
			// summary:
			//		Execute the callback when the store has been loaded. If an error
			//		is detected that will prevent the store from getting ready errback
			//		is called instead.
			// note:
			//		When the promise returned resolves it merely indicates one of
			//		potentially many load requests was successful. To keep track of
			//		a specific load request use the promise returned by the load()
			//		function instead.
			// callback:
			//		Function called when the store is ready.
			// errback:
			//		Function called when a condition was detected preventing the store
			//		from getting ready.
			// progress:
			// scope:
			//		The scope/closure in which callback and errback are executed. If
			//		not specified the store is used.
			// returns:
			//		dojo/promise/Promise
			// tag:
			//		Public
		},

		remove: function (/*Key|KeyRange*/ key) {
			// summary:
			//		Deletes an object by its key
			// key:
			//		The key or key range used to delete the object
			// returns:
			//		Returns true if an object was removed otherwise false.
			// tag:
			//		Public
		}

	});	/* end declare() */

	Store.PutDirectives = declare(null, {
		// summary:
		//		Directives passed to put() and add() handlers for guiding the update
		//		and creation of stored objects.
		// id: Key?
		//		For dojo/store compatibility only, use key instead.
		//		Indicates the identity of the object if a new object is created
		// key:
		//		Key value to be used for the object. Only allowed if no key path is
		//		specified for the store.
		// before: (Object|id)?
		//		If the collection of objects in the store has a natural ordering, this
		//		indicates that the created or updated object should be placed before
		//		the object specified by the value of this property. The property value
		//		can be an object or id. If omitted or null indicates that the object
		//		should be last.
		// parent: any?,
		//		If the store is hierarchical this property indicates the new parent(s)
		//		of the created or updated object. This property value can be an Id or
		//		object or an array of those types.
		// overwrite: Boolean?
		//		If this is provided as a boolean it indicates that the object should or
		//		should not overwrite an existing object. A value of true indicates that
		//		a new object should not be created, instead the operation should update
		//		an existing object. A value of false indicates that an existing object
		//		should not be updated, a new object should be created (which is the same
		//		as an add() operation). When this property is not provided, either an
		//		update or creation is acceptable.
	});

	Store.SortInformation = declare(null, {
		// summary:
		//		An object describing what attribute to sort on, and the direction of
		//		the sort.
		// attribute: String
		//		The name of the attribute to sort on.
		// descending: Boolean?
		//		The direction of the sort.	Default is false.
		// ignoreCase: Boolean?
		//		Compare attribute values case insensitive. Default is false.
	});

	Store.QueryOptions = declare(null, {
		// summary:
		//		Optional object with additional parameters for query results.
		// sort: dojo/store/api/Store.SortInformation[]?
		//		A list of attributes to sort on, as well as direction
		//		For example:
		//		| [{attribute:"price, descending: true}].
		//		If the sort parameter is omitted, then the natural order of the store
		//		may be applied if there is a natural order.
		// start: Number?
		//		The first result to begin iteration on
		// count: Number?
		//		The number of how many results should be returned.
		// ignoreCase: Boolean?
		//		Match object properties case insensitive. Default is false.
	});

	return Store;
});
