<?php

class MediaType {
	public $text, $type, $subtype, $parameters = ['q' => 1];

	public function __construct($header = null) {
		$this->parse($header);
	}

	public function parse($text = "") {
		$types   = "application|audio|image|message|model|multipart|text|video";
		$pattern = "<(($types)\/([^;]+))(;(.*))?$>i";
		$type    = null;

		if($text) {
			$mediaRange = explode(',', $text);
			forEach($mediaRange as $mediaType) {
				$mediaType = preg_replace('<\s+>', '', $mediaType);
				if (preg_match($pattern, $mediaType, $args)) {
					$this->text = $args[1];
					$this->type = $args[2];
					$this->subtype = $args[3];

					$this->parseParameters(@$args[5]);
					return true;
				}
			}
		}
		return false;
	}

	private function parseParameters($args = null) {
		if ($args) {
			$params = explode(';', trim($args, ';'));
			forEach($params as $assign) {
				list($key, $value) = explode('=', $assign);
				$this->parameters[$key] = $value;
			}
		}
	}
}

class MediaTypes {
	public $count = 0;
	protected $types = array();

	public function __construct($header = "") {
		if ($header) {
			$values = explode(',', $header);
			forEach($values as $value) {
				$mediaType = new MediaType($value);
				if ($mediaType->type && $mediaType->subtype) {
					$this->types[] = $mediaType;
					$this->count++;
				}
			}
			usort($this->types, array("MediaTypes", "cmpTypes"));
		}
	}

	public function __destruct() {
		forEach ($this->types as $mediaType) {
			unset ($mediaType);
		}
		unset ($this->types);
	}
	
	public function contains($type, $subtype) {
		forEach($this->types as $mediaType) {
			if ($subtype && $mediaType->subtype != trim($subtype)) {
				continue;
			}
			if ($type && $mediaType->type != trim($type)) {
				continue;
			}
			return $mediaType;
		}
		return false;
	}

	public function preferred($type = null, $subtypes = null) {
		$mediaType = null;
		if ($this->count) {
			if ($subtypes) {
				$stypes = is_array($subtypes) ? $subtypes : preg_split("<\s*,\s*>", $subtypes);
				forEach($this->types as $requested) {
					if (in_array($requested->subtype, $stypes)) {
						$mediaType = $requested;
						break;
					}
				}
			} else {
				$mediaType = $this->types[0];
			}
		}
		return $mediaType;
	}

	static function cmpTypes($typeA, $typeB) {
		if ($typeA->parameters['q'] < $typeB->parameters['q']) {
			return -1;
		} elseif ($typeA->parameters['q'] > $typeB->parameters['q']) {
			return 1;
		}
		return 0;
	}
}
?>