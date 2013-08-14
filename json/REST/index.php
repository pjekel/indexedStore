<?php

	spl_autoload_register('apiAutoload');

	function apiAutoload($classname)
	{
		if (preg_match('/[a-zA-Z]+Controller$/', $classname)) {
			include __DIR__ . '/controllers/' . $classname . '.php';
			return true;
		} elseif (preg_match('/[a-zA-Z]+Model$/', $classname)) {
			include __DIR__ . '/models/' . $classname . '.php';
			return true;
		} elseif (preg_match('/[a-zA-Z]+View$/', $classname)) {
			include __DIR__ . '/views/' . $classname . '.php';
			return true;
		} else {
			include __DIR__ . '/library/' . str_replace('_', '/', $classname) . '.php';
			return true;
		}
		return false;
	}

	function cgiResponse( $status, $statText, $infoText = null) {
		$hdrtxt = trim($status . ' ' . $statText);
		header("Content-Type: text/html");
		header("HTTP/1.1 " . $hdrtxt);
		header("Status: " . $hdrtxt );

		if ($infoText) {
			print($infoText);
		}
	}

	$request = new Request();

	$controlerName = ucfirst($request->keyword) . 'Controller';
	if (class_exists($controlerName)) {
		$controller = new $controlerName();
		$actionName = $request->verb . 'Action';
		if ($actionName && method_exists($controller, $actionName)) {
			$results  = $controller->$actionName($request);
			$viewName = ucfirst($request->format) . 'View';
			if(class_exists($viewName)) {
				$view = new $viewName();
				$view->render($results);
			} else {
				cgiResponse(406, "Not Acceptable", "Ho Lee Chit, I don't speak $request->format");
			}
		} else {
			cgiResponse(405, "Method Not Allowed", "Ho Lee Chit, what's next?");
		}
	} else {
		cgiResponse(404, "Not Found", "Ho Lee Chit, say what?");
	}
?>
