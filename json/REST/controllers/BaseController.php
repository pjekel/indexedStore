<?php

abstract class BaseController {

	abstract public function getAction($request);

	public function deleteAction($request) {
		return $request->path;
	}

	public function putAction($request) {
		return $request->content;
	}

	public function postAction($request) {
		return $request->content;
	}

}
