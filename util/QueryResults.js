define(["dojo/store/util/QueryResults"], function (QueryResults) {
	// module
	//		indexedStore/util/QueryResults
	// summary:
	//		In case results is a Promise or Deferred, this QueryResults quarantees
	//		that the results property 'total' is actually a number once the results
	//		resolve and not yet another promise.
	
	return function (results) {
		var qr = QueryResults(results);
		// In case results is a Promise or Deferred
		if (typeof qr.then == "function") {
			qr.total = qr.then( function (ob) {
				qr.total = ("total" in ob) ? ob.total : ob.length;
				return qr.total;
			});
		}
		return qr;
	};
});