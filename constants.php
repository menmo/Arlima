<?php

define('ARLIMA_PLUGIN_PATH', dirname(__FILE__));
define('ARLIMA_PLUGIN_URL', plugin_dir_url(__FILE__));
define('ARLIMA_DEV_MODE', true);
define('ARLIMA_FILE_VERSION', '2.7.2' .(ARLIMA_DEV_MODE ? time():''));