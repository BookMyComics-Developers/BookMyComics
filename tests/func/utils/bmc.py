from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.common.exceptions import NoSuchElementException


class FrameFocus:
    def __init__(self, driver, frame):
        self._driver = driver
        self._frame = frame

    def __enter__(self):
        WebDriverWait(self._driver, 30).until(
            EC.frame_to_be_available_and_switch_to_it(self._frame))

    def __exit__(self, type, value, traceback):
        self._driver.switch_to.parent_frame()


class ItemSource:
    """
        Represents a registered Comic's source in the DOM.
        This class provide utilities to manipulate and check sources.
    """
    def __init__(self, sidepanel, dom_element):
        self._panel = sidepanel
        self._dom = dom_element

    def click(self):
        self._dom.find_element(by=By.CSS_SELECTOR, value='.label').click()

    def delete(self):
        with self._panel.focus():
            label = self._dom.find_element(by=By.CSS_SELECTOR, value='.label')
            del_btn = self._dom.find_element(by=By.CSS_SELECTOR, value='.fa-trash')
            actions = ActionChains(self._panel._driver)
            actions.move_to_element(label)
            actions.move_to_element(del_btn)
            actions.click(del_btn)
            actions.perform()

class RegisteredItem:
    """
        Represents and allows to control a registered manga/comic in the
        SidePanel
    """

    def __init__(self, sidepanel, dom_element):
        self._panel = sidepanel
        self._dom = dom_element
        self._name = None
        self._sources = None

    @property
    def sources(self):
        if self._sources is None:
            with self._panel.focus():
                self._sources = self._list_sources_nofocus()
        return self._sources

    @property
    def name(self):
        if self._name is None:
            with self._panel.focus():
                self._name = self._dom.find_element(by=By.CSS_SELECTOR, value='.label-container > .label.rollingArrow').text
        return self._name

    def _list_sources_nofocus(self):
        """ Returns a list of ItemSource for the RegisteredItem """
        if self.folded:
            self.toggle()
        items = self._dom.find_elements(by=By.CSS_SELECTOR, value='.nested > .label-container')
        return [ItemSource(self._panel, item) for item in items]

    def delete(self):
        """
            Deleted the RegisteredItem by triggering a click on the associated
            delete button
        """
        with self._panel.focus():
            label = self._dom.find_element(by=By.CSS_SELECTOR, value=':not(.nested) > .label-container .label')
            del_btn = self._dom.find_element(by=By.CSS_SELECTOR, value=':not(.nested) > .label-container .fa-trash')
            actions = ActionChains(self._panel._driver)
            actions.move_to_element(label)
            actions.move_to_element(del_btn)
            actions.click(del_btn)
            actions.perform()

    @property
    def folded(self):
        """
            Return a boolean telling whether the RegisteredItem's sources are
            unrolled of rolled-up
        """
        fold_marker = self._dom.find_element(by=By.CSS_SELECTOR, value='.label-container > .label.rollingArrow')
        return "rollingArrow-down" not in fold_marker.get_attribute("class")

    def toggle(self):
        """
            Unrolls (unfold) or Rolls (fold) all the sources for the
            RegisteredItem, effectively showing/hiding them.
        """
        fold_marker = self._dom.find_element(by=By.CSS_SELECTOR, value='.label-container > .label.rollingArrow')
        fold_marker.click()

    def wait_for_removal(self, timeout=10):
        with self._panel.focus():
            WebDriverWait(self._panel._driver, timeout).until(EC.staleness_of(self._dom))

class SideBarController:
    SIDEPANEL_ID = 'BmcSidePanel'

    def __init__(self, driver):
        self._driver = driver
        def finder(driver):
            return driver.find_element(by=By.ID, value=self.SIDEPANEL_ID)
        WebDriverWait(self._driver, 10).until(finder)
        self._frame = finder(self._driver)

    @property
    def loaded(self):
        """
            Checks if the frame with `id` SIDEPANEL_ID is loaded into
            the page. This one marker that the extension was properly
            loaded.
        """
        return not (self._frame is None)

    @property
    def size(self):
        """
            This function returns the current size of the sidepanel's frame.

            Returns a dict containing "height" and "width" keys
        """
        return self._frame.size

    @property
    def hidden(self):
        ret = False
        with FrameFocus(self._driver, self._frame):
            WebDriverWait(self._driver, 10).until(
                lambda driver:
                driver.find_element(by=By.ID, value='side-panel'))
            mode_std = \
                self._driver.find_element(by=By.ID, value='side-panel')
            WebDriverWait(self._driver, 10).until(
                lambda driver:
                driver.find_element(by=By.ID, value='side-panel-adder'))
            mode_adder = \
                self._driver.find_element(by=By.ID, value='side-panel-adder')
            ret = not (mode_std.is_displayed() or mode_adder.is_displayed())
        return ret

    def focus(self):
        """
            Returns a FrameFocus object to be used as a ContextManager.

            This allows hiding the internal properties of the sidebar, while
            allowing to force the driver to focus on its frame, so that its
            contents can be inspected by the calling code.
        """
        return FrameFocus(self._driver, self._frame)

    def toggle(self):
        with FrameFocus(self._driver, self._frame):
            togbtn = self._driver.find_element(by=By.ID, value='hide-but')
            txt = togbtn.text
            WebDriverWait(self._driver, 10).until(EC.element_to_be_clickable)
            togbtn.click()
            if txt == '>':
                WebDriverWait(self._driver, 10).until(
                    lambda driver:
                    driver.find_element(
                        by=By.ID, value='hide-but').text == '<')
            elif txt == '<':
                WebDriverWait(self._driver, 10).until(
                    lambda driver:
                    driver.find_element(
                        by=By.ID, value='hide-but').text == '>')

    def wait_for_text(self, expected_text, elem_id, timeout=10):
        with FrameFocus(self._driver, self._frame):
            wait = WebDriverWait(self._driver, timeout)
            wait.until(EC.text_to_be_present_in_element((By.ID, elem_id), expected_text))

    def start_registration_nofocus(self):
        """
            This function starts the registration process by clicking on the
            "+" button, and waiting to ensure that the SideBar is properly
            displayed with the right mode.

            Must be called within a FrameFocus's context.
        """
        add_btn = self._driver.find_element(by=By.ID, value='register-but')
        WebDriverWait(self._driver, 10).until(
            lambda driver: add_btn.is_displayed())
        # Ensure that we can click on it.
        assert add_btn.is_enabled() and add_btn.is_displayed()
        add_btn.click()

        try:
            WebDriverWait(self._driver, 5).until(
                lambda driver: driver.find_element(
                    by=By.CSS_SELECTOR, value='#side-panel-adder > #bookmark-name').is_displayed())
        except:
            # Maybe the click failed for whatever reason? Let's retry...
            add_btn.click()
            WebDriverWait(self._driver, 5).until(
                lambda driver: driver.find_element(
                    by=By.CSS_SELECTOR, value='#side-panel-adder > #bookmark-name').is_displayed())
        elem = self._driver.find_element(by=By.CSS_SELECTOR, value='#side-panel-adder > #bookmark-name')
        assert elem.is_displayed()

    def wait_for_sidepanel_visible_nofocus(self):
        # Wait for the side-panel to be visible again.
        # The code ensures that it should be shown only after the manga-list
        # has been completely re-generated.
        WebDriverWait(self._driver, 10).until(
            EC.visibility_of_element_located((By.ID, 'side-panel')))

    def register(self, display_name, expect_failure=False):
        """
            Allows to register the current page under the name `display_name`

            Note that at this moment, the function does not handle adding a new
            souce to an existing entry, and only attmepts to create a new
            entry.
        """
        with FrameFocus(self._driver, self._frame):
            self.start_registration_nofocus()
            input_field = self._driver.find_element(
                by=By.CSS_SELECTOR, value='#side-panel-adder > #bookmark-name')
            input_field.clear()
            input_field.send_keys(display_name)
            cfrm_btn = self._driver.find_element(
                by=By.CSS_SELECTOR, value='#side-panel-adder > #add-confirm.button-add')
            cfrm_btn.click()
            if not expect_failure:
                self.wait_for_sidepanel_visible_nofocus()
                def registered_entry_available(driver):
                    elms = driver.find_elements(by=By.CSS_SELECTOR, value='.label.rollingArrow')
                    for elm in elms:
                        if elm.text == display_name:
                            return True
                    return False
                WebDriverWait(self._driver, 10).until(registered_entry_available)

    def check_registration_error(self, do_wait=True):
        """
            Asserts whether the error display shows an error
        """
        with FrameFocus(self._driver, self._frame):
            disp = self._driver.find_element(
                by=By.CSS_SELECTOR, value='#side-panel-adder > #error-display')
            if do_wait is False:
                assert disp.value_of_css_property('display') == 'none'
            else:
                def validator(driver):
                    elm = driver.find_element(
                            by=By.CSS_SELECTOR, value='#side-panel-adder > #error-display')
                    return (elm.value_of_css_property('display') == 'block'
                            and elm.text != '')
                WebDriverWait(self._driver, 10).until(validator)

    def get_registered(self):
        """
            Returns a list of RegisteredItems from the current content of the
            SidePanel
        """
        with FrameFocus(self._driver, self._frame):
            items = []
            try:
                self.wait_for_sidepanel_visible_nofocus()
                items = self._driver.find_elements(
                    by=By.CSS_SELECTOR, value='#manga-list .mangaListItem')
            except NoSuchElementException:
                pass
        return [RegisteredItem(self, i) for i in items]

    def load(self, name, wait_for_url_change=True):
        """
            Searches a registered entry matching `name`, and loads the
            associated comic by clicking on the element.
        """
        prev_url = self._driver.current_url
        with FrameFocus(self._driver, self._frame):
            self.wait_for_sidepanel_visible_nofocus()
            items = self._driver.find_elements(by=By.CSS_SELECTOR, value='#manga-list .mangaListItem')
            # Need to check text at relative xpath: '.label-container .label .inner_text'
            selected = [i for i in items if i.find_element(by=By.CSS_SELECTOR, value='.label-container .label').text == name]
            assert len(selected) == 1
            comic = RegisteredItem(self, selected[0])
            sources = comic._list_sources_nofocus()
            assert len(sources) == 1
            sources[0].click()
        if wait_for_url_change:
            WebDriverWait(self._driver, 10).until(EC.url_changes(prev_url))

    def check_notification_nofocus(self, predicate):
        def toggle_but_is_notif(driver):
            but = driver.find_element(by=By.ID, value='hide-but')
            return 'notif-transform' in but.get_attribute('class')
        predicate(toggle_but_is_notif)

    def wait_notification(self):
        """
            Waits until the hide button contains the 'notif-transform' class,
            which shows that a change occurred to notify the user.
            -> ie: Can be a Storage operation that completed (alias, delete,
                   register, etc)
        """
        with FrameFocus(self._driver, self._frame):
            self.check_notification_nofocus(WebDriverWait(self._driver, 10).until)

    def wait_notification_done(self):
        """
            Waits until the hide button contains the 'notif-transform' class,
            which shows that a change occurred to notify the user.
            -> ie: Can be a Storage operation that completed (alias, delete,
                   register, etc)
        """
        with FrameFocus(self._driver, self._frame):
            # Wait for notification to appear
            self.check_notification_nofocus(WebDriverWait(self._driver, 10).until)
            # Then for it to finish
            self.check_notification_nofocus(WebDriverWait(self._driver, 10).until_not)

    def reset_notification(self):
        """
            Waits until the hide button contains the 'notif-transform' class,
            which shows that a change occurred to notify the user.
            -> ie: Can be a Storage operation that completed (alias, delete,
                   register, etc)
        """
        with FrameFocus(self._driver, self._frame):
            try:
                if self._driver.find_element(by=By.CLASS_NAME, value='notif-transform'):
                    self._driver.execute_script('document.querySelector(".notif-transform").classList.remove("notif-transform")')
            except NoSuchElementException:
                pass


class OptionsController:
    def __init__(self, driver):
        self._driver = driver

    def open(self):
        self._driver.open_options()
        def populated(driver):
            selector = Select(driver.find_element(by=By.ID, value='storage-selector'))
            return len(selector.options) > 0
        WebDriverWait(self._driver.driver, 10).until(populated)

    def wait_notification(self, zone_id):
        """
            Waits until the hide button contains the 'notif-transform' class,
            which shows that a change occurred to notify the user.
            -> ie: Can be a Storage operation that completed (alias, delete,
                   register, etc)
        """
        def zone_is_notifying(driver):
            zone = driver.find_element(by=By.ID, value=zone_id)
            return 'notif-transform' in zone.get_attribute('class')
        # Unwrap the driver to use WebDriver utilities
        WebDriverWait(self._driver.driver, 10).until(zone_is_notifying)


class BmcController:

    def __init__(self, wrapped_webdriver):
        self._wrapped_driver = wrapped_webdriver
        self._options = OptionsController(wrapped_webdriver)
        self._sidebar = None

    @property
    def driver(self):
        """
            Access the underlying webdriver directly.
            This is sometimes easier to go through this rather than wrap all
            calls to "hide"
        """
        return self.wrapped_driver.driver

    @property
    def wrapped_driver(self):
        """
            Access the wrapped webdriver.
            This enables possible use of common utility methods from the
            wrapper.
        """
        return self._wrapped_driver

    @property
    def sidebar(self):
        """
            Get the WebComponent corresponding to the SidePanel's iframe in the
            current window

            This is a lazy resolution, to ensure that we get the frame only
            when it's necessary (and supposed to be possible).
        """
        if not self._sidebar:
            self._sidebar = SideBarController(self.driver)
        return self._sidebar

    @property
    def options(self):
        """
            Get a handle to the utility class wrapping the Options page
        """
        return self._options

    def register(self, display_name, expect_failure=False):
        """
            Register the current manga/comic page as a new entry in the
            extension.
        """
        self.sidebar.register(display_name, expect_failure)

    def refresh(self):
        """
            Allows refreshing the Controller's internal state, to fit a
            new/refreshed page, and avoid stale WebElements
        """
        self._sidebar = None

    def reset(self):
        """
            Used by autouse fixtures

            This method forces a reset of the internal state of the controller,
            as well as the stored data, to ensure no overlap/conflict between
            functional tests.
        """
        if not self._sidebar:
            return
        self.refresh()
        with self.sidebar.focus():
            self._wrapped_driver.clear_storage()
        self.refresh()


def init_sidebar(reader_driver, controller, load_random=True, predicate=None):
    if load_random is True:
        reader_driver.load_random(predicate=predicate)
    assert controller.sidebar.loaded
    if controller.sidebar.hidden:
        controller.sidebar.toggle()
    assert controller.sidebar.hidden is False
