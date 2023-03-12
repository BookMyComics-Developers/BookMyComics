import functools
import pytest

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys

from .utils.bmc import init_sidebar
from .utils import predicates


@pytest.mark.order(after='test_sidebar_display.py')
class TestUtilities:

    @staticmethod
    def test_navigation(reader_driver):
        reader_driver.load_random()
        if not reader_driver.has_prev_page():
            reader_driver.next_page()
            reader_driver.prev_page()
        else:
            reader_driver.prev_page()
            reader_driver.next_page()

    @staticmethod
    def test_webext_loads(controller, reader_driver):
        # Load the reader's Home URL
        reader_driver.home()
        # Ensure that the frame with ID 'BmcSidePanel' is loaded.
        # That's the marker that the extension was loaded properly
        assert controller.sidebar.loaded


@pytest.mark.order(after='TestUtilities')
class TestRegister:

    @staticmethod
    def test_register_disabled_on_homepage(controller, reader_driver):
        """
            Validates that the register/delete buttons are not visible to the
            user on the reader's home page.
        """
        reader_driver.home()
        assert controller.sidebar.loaded
        assert controller.sidebar.hidden
        # Check that both register and delete buttons are not available
        with controller.sidebar.focus():
            add_btn = controller.driver.find_element(by=By.ID, value='register-but')
            del_btn = controller.driver.find_element(by=By.ID, value='delete-but')
            assert not add_btn.is_displayed()
            assert not del_btn.is_displayed()
        # Check again, with the sidebar opened
        controller.sidebar.toggle()
        with controller.sidebar.focus():
            add_btn = controller.driver.find_element(by=By.ID, value='register-but')
            del_btn = controller.driver.find_element(by=By.ID, value='delete-but')
            assert not add_btn.is_displayed()
            assert not del_btn.is_displayed()

    @staticmethod
    def test_btn_visible_on_unregistered(controller, reader_driver):
        """
            Validates that the 'register' button (a '+' symbol) is visible when
            the browsed comic is unregistered.
        """
        reader_driver.load_random()
        assert controller.sidebar.loaded
        if not controller.sidebar.hidden:
            controller.sidebar.toggle()
        assert controller.sidebar.hidden is True
        with controller.sidebar.focus():
            reg_btn = controller.driver.find_element(
                by=By.CSS_SELECTOR, value='body > div#register-but')
            assert reg_btn.is_displayed()

    @staticmethod
    def test_bookmark_name_input_automatic_fill(controller, reader_driver):
        """
            Validates that the bookmark input is already filled with the comic
            name when you are registering a new comic.
        """
        init_sidebar(reader_driver, controller)
        assert len(controller.sidebar.get_registered()) == 0
        # Retrieve out of sidebar focus
        cur_name = reader_driver.get_comic_name()
        with controller.sidebar.focus():
            controller.sidebar.start_registration_nofocus()
            bookmark_input = controller.driver.find_element(
                by=By.CSS_SELECTOR, value='#bookmark-name')
            assert bookmark_input.is_displayed()
            assert bookmark_input.get_attribute('value') == cur_name

    @staticmethod
    def test_registration(controller, reader_driver):
        """
            Validates that the comic registration goes well, and can be
            confirmed by the user: the new comic is visible in the SidePanel's
            MangaList immediately after registration
        """
        init_sidebar(reader_driver, controller)
        orig_n_items = len(controller.sidebar.get_registered())
        controller.register('sample100')
        assert len(controller.sidebar.get_registered()) != orig_n_items


@pytest.mark.order(after='TestUtilities')
class TestNavigate:
    @staticmethod
    def test_source_load(controller, reader_driver):
        """
            Validates that the registered comic can be properly loaded by
            clicking on the SidePanel's associated entry.
        """
        #
        # Do the registration first
        #
        init_sidebar(reader_driver, controller)
        orig_n_items = len(controller.sidebar.get_registered())
        controller.register('sample100-load')
        assert len(controller.sidebar.get_registered()) != orig_n_items

        #
        # With registration confirmed, Record URL/chapter/page
        # then back to home page
        #
        expected_url = controller.driver.current_url
        expected_name = reader_driver.get_comic_name()
        expected_chapter = reader_driver.get_chapter()
        expected_page = reader_driver.get_page()
        reader_driver.home()
        # Required, as consequence of going Home
        controller.refresh()

        #
        # Click on the SidePanel entry to load the comic, and check
        # url/chapter/page
        #
        controller.sidebar.load('sample100-load')
        assert controller.driver.current_url == expected_url
        assert reader_driver.get_comic_name() == expected_name
        assert reader_driver.get_chapter() == expected_chapter
        assert reader_driver.get_page() == expected_page

    @staticmethod
    def test_tracking(controller, reader_driver):
        """
            Validates that the reader is able to update its internal
            information about a comic when browsed towards the end
        """
        #
        # Do the registration first
        #
        init_sidebar(reader_driver, controller,
                     predicate=predicates.with_next_page)
        orig_n_items = len(controller.sidebar.get_registered())
        controller.register('sample100')
        controller.sidebar.wait_notification_done()
        assert len(controller.sidebar.get_registered()) != orig_n_items

        #
        # With registration confirmed, Record URL/chapter/page
        # then back to home page
        #
        prev_url = controller.driver.current_url

        # Now, browse to the next page
        controller.sidebar.toggle()  # Hide it to ensure we can click on next_page
        controller.sidebar.reset_notification()
        reader_driver.next_page()
        controller.refresh()
        controller.sidebar.wait_notification()
        controller.sidebar.toggle()  # Show it again to manipulate it

        # Check that the registered page was updated
        # -> We need to access the latest link from sidebar to check if the
        # generated URL changed.
        reader_driver.home()
        controller.refresh()
        controller.sidebar.load('sample100')
        assert controller.driver.current_url != prev_url

    @staticmethod
    def test_backwards_tracking(controller, reader_driver):
        """
            Validates that the reader does not update its internal
            information about a comic when browsed towards the beginning
        """
        #
        # Do the registration first
        #
        init_sidebar(reader_driver, controller,
                     predicate=predicates.with_prev_page)
        orig_n_items = len(controller.sidebar.get_registered())
        controller.register('sample100')
        assert len(controller.sidebar.get_registered()) != orig_n_items

        #
        # With registration confirmed, Record URL/chapter/page
        # then back to home page
        #
        expected_url = controller.driver.current_url

        # Now, browse to the prev page
        controller.sidebar.toggle() # Hide it to ensure we can click on prev-page
        reader_driver.prev_page()

        # Check that the registered page was updated
        # -> We need to access the latest link from sidebar to check if the
        # generated URL changed.
        reader_driver.home()
        controller.refresh()
        controller.sidebar.toggle() # Show it again
        controller.sidebar.load('sample100')
        assert controller.driver.current_url == expected_url
