define ([], function () {

	if (Function.prototype.name === undefined){
	  Object.defineProperty(Function.prototype,'name',{
		get:function(){
		  return /function ([^(]*)/.exec( this+"" )[1];
		}
	  });
	}

});