<?php

class Request {
	public $content, $headers, $keyword, $parameters, $path, $verb;

    public function __construct() {
		$path = $_SERVER['PATH_INFO'];
		preg_match("<^\/([^\/]+)\/?>", $path, $key);

		$this->headers = getallheaders();
		$this->keyword = $key[1];
		$this->path    = preg_replace("<^\/([^\/]+)\/?>", "", $path);
        $this->verb    = $_SERVER['REQUEST_METHOD'];

        // initialise json as default format
		$this->format   = 'json';
        $this->parseParameters();
    }

	public function deleteParameter($name) {
		if (array_key_exists($name, $this->parameters)) {
			unset($this->parameters[$name]);
		}
	}

	public function getHeader($type) {
		$type = str_replace(' ', '-', ucwords(strtolower(str_replace(['_', '-'], ' ', $type))));
		return $this->headers[$type];
	}

	public function getParameter($name, $default = null, $remove = false) {
		if (array_key_exists($name, $this->parameters)) {
			$value = $this->parameters[$name];
			if ($remove) {
				$this->deleteParameter($name);
			}
			return $value;
		}
		return $default;
	}

	public function getMediaTypes($header = "Content-Type") {
		$hdrText = $this->getHeader($header);
		$types   = new MediaTypes($hdrText);
		return $types;
	}

    private function parseParameters() {
        $parameters = array();

        // first of all, pull the GET vars
        if (isset($_SERVER['QUERY_STRING'])) {
            parse_str($_SERVER['QUERY_STRING'], $parameters);
		}

        // now how about PUT/POST bodies? These override what we got from the query string
        $content     = file_get_contents("php://input");
		$mediaTypes  = $this->getMediaTypes('Content-Type');
		$contentType = $mediaTypes->preferred();
        switch($contentType->subtype) {
            case "json":
				$this->content = json_decode($content);
				if($this->content) {
					foreach($this->content as $param_name => $param_value) {
						$parameters[$param_name] = $param_value;
					}
				}
				$this->format = $this->getFormat('json');
				break;
            case "x-www-form-urlencoded":
				parse_str($content, $this->content);
				foreach($this->content as $field => $value) {
					$parameters[$field] = $value;
				}
				$this->format = $this->getFormat('html, json');
				break;
            default:
                // we could parse other supported formats here
                break;
        }
        $this->parameters = $parameters;
    }

	private function getFormat($subtypes = null) {
		$suppTypes = $subtypes ? (is_array($subtypes) ? $subtypes : preg_split("<\s*,\s*>", $subtypes) ) : ["json"];
		$respTypes = $this->getMediaTypes('Accept');
		$preferred = $respTypes->preferred(null, $subtypes);

		return $preferred ? $preferred->subtype : $suppTypes[0];
	}
}
?>