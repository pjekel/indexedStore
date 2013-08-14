<?php
	class FileController extends BaseController	{

		protected function query($data, $query) {
			$fileList = is_array($data) ? $data : array($data);
			$modifier = ["i", "m", "s", "x", ];
			$results  = array();
			$match    = false;

			// Pre-process query arguments once...
			forEach ($query as $key => $value) {
				if (preg_match("<^([\/|<](.+)?[\/|>])(.*)$>", $value, $express)) {
					$flags   = implode(array_intersect(str_split($express[3]), $modifier));
					$regexp  = $express[1] . $flags;
					$props[$key] = [1, $regexp];
				} else {
					$props[$key] = [0, $value];
				}
			}
			forEach ($fileList as $fileInfo) {
				forEach($props as $key => $prop) {
					list($type, $value) = $prop;
					switch ($type) {
						case 0:
							$match = (@$fileInfo->$key == $value);
							break;
						case 1:		// regexp
							$match = (bool)preg_match($value, @$fileInfo->$key);
							break;
						default:
							$match = false;
					}
					if (!$match) {
						break;
					}
				}
				if ($match) {
					$results[] = $fileInfo;
				}
			}
			return $results;
		}

		protected function getDirectory($pathInfo, $recursive = false, $tree = false) {
			$files = array();

			if( ($dirHandle = opendir($pathInfo->fullPath)) ) {
				while($file = readdir($dirHandle)) {
					if ($file != "." && $file != "..") {
						$filePath = new PathInfo($pathInfo->relPath . '/' . $file);
						$fileInfo = $filePath->getFileInfo();
						$files[]  = $fileInfo;

						if (@$filePath->isDir && $recursive) {
							$children = $this->getDirectory($filePath, $recursive, $tree);
							if ($tree) {
								$fileInfo->children = $children;
							} else {
								$files = array_merge($files, $children);
							}
						}
					}
				}
				closedir($dirHandle);
			}
			return $files;
		}

		protected function grepFiles($pathInfo, $recursive) {
			$data = null;
			if (isset($pathInfo)) {
				if ($pathInfo->isDir) {
					$data = $this->getDirectory($pathInfo, $recursive);
				} else {
					if (file_exists($pathInfo->fullPath)) {
						$data = new FileInfo($pathInfo);
					}
				}
			}
			return $data;
		}

		public function getAction($request) {
			$deep     = $request->getParameter('deep', false, true);
			$query    = (bool)count($request->parameters);
			$path     = $request->path;
			$results  = null;

			if ($query && !strlen($path)) {
				$parent = $request->getParameter('parent');
				if ($parent) {
					if(!preg_match("<^\/(.+)?\/$>", $parent)) {
						$path = $parent;
					} else {
						$deep = true;
					}
				}
			}
			$pathInfo = new PathInfo($path);
			$rawData  = $this->grepFiles($pathInfo, $deep);
			if ($rawData && $query) {
				$results = $this->query($rawData, $request->parameters);
			} else {
				$results = $rawData;
			}
			return $results;
		}

	}
?>