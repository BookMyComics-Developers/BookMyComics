import json
from os import path
import uuid

from selenium import webdriver
from selenium.webdriver.common.action_chains import ActionChains

from .base import BaseWebdriverWrapper


class Wrapper(BaseWebdriverWrapper):
    def __init__(self, *args, **kwargs):
        super(Wrapper, self).__init__(*args, **kwargs)

        options = webdriver.FirefoxOptions()
        if self._headless:
            options.add_argument('-headless')

        # Now prepare args to instanciate the Selenium WebDriver,
        # including snapd distribution support
        driver_args = {'options': options}
        if self.distributed_via_snap('firefox', 'geckodriver'):
            options.binary_location = path.join(
                self._snap_prefix,
                'firefox/current/usr/lib/firefox/firefox-bin'
            )
            driver_args['service'] = webdriver.firefox.service.Service(
                executable_path=path.join(
                    self._snap_prefix,
                    'firefox/current/usr/lib/firefox/geckodriver',
                ),
            )

        #
        # Customize a profile, to force the web-extension's UUID
        # Which in turn, allows us to guess the options Page URL
        #
        # The logic is a courtesy of the comments from the following article
        # https://airtower.wordpress.com/2020/07/19/configure-a-firefox-web-extension-from-selenium/
        #
        with open(self._ext._manifest_path) as fh:
            manifest = json.load(fh)
        addon_id = (
            manifest
            .get("browser_specific_settings", {})
            .get("gecko", {})
            .get("id", "support@bookmycomics.org")
        )
        self._webext_uuid = str(uuid.uuid4())
        # Pre-seed the dynamic addon ID so we can find the options page
        options.set_preference('extensions.webextensions.uuids',
                               json.dumps({addon_id: self._webext_uuid}))

        self._driver = webdriver.Firefox(**driver_args)

        print('[Firefox] Loading addon from "{}"'.format(self._ext.packed_path))
        print('[Firefox] Loading manifest from "{}"'.format(self._ext._manifest_path))
        self._driver.install_addon(self._ext.packed_path, temporary=True)
        print(f'[Firefox] Addon uuid: {self._webext_uuid}')

    def ensure_click(self, element):
        """
            Ensures that the element is clickable (within viewport) then clicks
            on it.
        """
        ActionChains(self._driver).move_to_element(element).perform()
        element.click()

    def clear_storage(self):
        """
            Clears local & session storage from the browser
        """
        self._driver.execute_script(
            "(chrome || window.chrome || browser || window.browser)"
            ".storage.local.clear().catch(e=>{}).then(()=>{});")
        self._driver.execute_script(
            "(chrome || window.chrome || browser || window.browser)"
            ".storage.sync.clear().catch(e=>{}).then(()=>{});")

    def open_options(self):
        self._driver.get(f'moz-extension://{self._webext_uuid}/options.html')
