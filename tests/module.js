define(["doh/main", "require"], function(doh, require){

	// Make sure the keys functionality is tested first as it is the foundation
	// of most other functions.
	
	doh.register("Store Keys", require.toUrl("./test_Keys.html"), 999999);

	doh.register("Natural Store", require.toUrl("./test_NaturalStore.html"), 999999);
	doh.register("Indexed Store", require.toUrl("./test_IndexedStore.html"), 999999);
	doh.register("Compound Keys", require.toUrl("./test_Compound_Keys.html"), 999999);
	doh.register("Store Indexes", require.toUrl("./test_Indexes.html"), 999999);
	doh.register("Store Loader Base", require.toUrl("./test_Loader_Base.html"), 999999);
	doh.register("Store Loader Plus", require.toUrl("./test_Loader_Plus.html"), 999999);
	doh.register("Store Cursors", require.toUrl("./test_Store_Cursors.html"), 999999);
	doh.register("Index Cursors", require.toUrl("./test_Index_Cursors.html"), 999999);
	doh.register("Store Ranges", require.toUrl("./test_Ranges.html"), 999999);
	doh.register("Query Engine", require.toUrl("./test_Query_Engine.html"), 999999);
	doh.register("Hierarchy Extension", require.toUrl("./test_Hierarchy_Extension.html"), 999999);
	doh.register("Ancestry Extension", require.toUrl("./test_Ancestry_Extension.html"), 999999);
	doh.register("Watch Extension", require.toUrl("./test_Watch_Extension.html"), 999999);
	doh.register("CORS Extension", require.toUrl("./test_CORS_Extension.html"), 999999);

});
