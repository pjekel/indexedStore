define(["doh/main", "require"], function(doh, require){

	doh.register("Natural Store", require.toUrl("./test_NaturalStore.html"), 999999);
	doh.register("Indexed Store", require.toUrl("./test_IndexedStore.html"), 999999);
	doh.register("Compound Keys", require.toUrl("./test_Compound_Keys.html"), 999999);
	doh.register("Store Cursors", require.toUrl("./test_Store_Cursors.html"), 999999);
	doh.register("Store Ranges", require.toUrl("./test_Ranges.html"), 999999);
	doh.register("Store Loader", require.toUrl("./test_Loader.html"), 999999);
	doh.register("Store Indexes", require.toUrl("./test_Indexes.html"), 999999);
	doh.register("Query Engine", require.toUrl("./test_Query_Engine.html"), 999999);
	doh.register("Hierarchy Extension", require.toUrl("./test_Hierarchy_Extension.html"), 999999);

});
