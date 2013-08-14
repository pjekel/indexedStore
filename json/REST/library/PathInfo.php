<?php

	class FileInfo {
		public $extension, $modified, $name, $path, $size;

		public function __construct($pathInfo, $stats = false) {
			$attrs = stat($pathInfo->fullPath);
			$segm  = explode('/', $pathInfo->relPath);
			$name  = array_pop($segm);

			$this->extension = trim(strrchr($name,'.'), '.');
			$this->modified  = $attrs[9] * 1000;
			$this->name      = $name;
			$this->path      = $pathInfo->relPath;
			$this->size      = filesize($pathInfo->fullPath);
			if ($pathInfo->isDir) {
				$this->directory = true;
			}
			return true;
		}
	}

	class PathInfo {
		public $fullPath, $isDir, $name, $relPath;

		public function __construct($path = "") {
			$docRoot  = $_SERVER["DOCUMENT_ROOT"];
			$basePath = $docRoot . '/';

			$this->fullPath = trim($basePath . $this->removeDotSegments($path), '/');
			$this->relPath  = trim(substr($this->fullPath, strlen($basePath)), '/');
			$this->isDir    = is_dir($this->fullPath);

			return true;
		}

		public function getFileInfo() {
			return new FileInfo($this);
		}

		private function removeDotSegments($path) {
			// summary:
			//		Remove any invalid or extraneous dot-segments prior to forming the
			//		target URI.(See rfc3986 $5.2.4 Remove Dot Segments).
			$newPath = $path;
			if (preg_match('<\.\/|\/\/>', $newPath)) {
				$segments = explode('/', $path);
				$length   = count($segments);
				$suffix   = $segments[$length-1] ? '' : '/';
				$prefix   = $segments[0] ? '' : '/';
				$newSegm  = array();

				forEach($segments as $value) {
					if ($value != '.' && $value != '') {
						if ($value == '..') {
							array_pop($newSegm);
						} else {
							$newSegm[] = $value;
						}
					}
				}
				$newPath = $prefix . implode('/', $newSegm) . $suffix;
			}
			return $newPath;
		}
	}

?>