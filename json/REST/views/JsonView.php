<?php

class JsonView extends ApiView {
    public function render($content) {
        header('Content-Type: application/json; charset=utf8');
		if ($content) {
			echo json_encode($content);
		}
        return true;
    }
}
