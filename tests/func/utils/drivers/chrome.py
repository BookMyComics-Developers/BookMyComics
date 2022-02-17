from os import path

from selenium import webdriver
from selenium.webdriver.common.action_chains import ActionChains

from .base import BaseWebdriverWrapper

class Wrapper(BaseWebdriverWrapper):

    def __init__(self, *args, **kwargs):
        super(Wrapper, self).__init__(*args, **kwargs)

        options = webdriver.ChromeOptions()
        options.add_argument('--load-extension={}'.format(self._ext.unpacked_path))
        if self._headless:
            options.add_argument('--headless=new')
        # Attempt to fix driver.get() getting stuck during tests.
        options.add_argument('--disable-browser-side-navigation')

        # Now prepare args to instanciate the Selenium WebDriver,
        # including snapd distribution support
        driver_args = {'options': options}
        if self.distributed_via_snap('chromium', 'chromedriver'):
            options.binary_location = path.join(
                self._snap_prefix,
                'chromium/current/usr/lib/chromium-browser/chrome'
            )
            driver_args['service'] = webdriver.chrome.service.Service(
                executable_path=path.join(
                    self._snap_prefix,
                    'chromium/current/usr/lib/chromium-browser/chromedriver',
                ),
                log_path='/tmp/chrome.log',
                service_args=['--verbose'],
            )

        print('[Chrome] Loading addon from "{}"'.format(self._ext.unpacked_path))
        print('[Chrome] Loading manifest from "{}"'.format(self._ext._manifest_path))
        self._driver = webdriver.Chrome(**driver_args)

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
            ".storage.local.clear(()=>{});")
        self._driver.execute_script(
            "(chrome || window.chrome || browser || window.browser)"
            ".storage.sync.clear(()=>{});")
