import  pytest

from .utils.extension import Extension
from selenium.webdriver.support.ui import WebDriverWait


EXT = Extension()
SIDEBAR_WIDTH = 206
COLLAPSED_SIDEBAR_HEIGHT = 86
COLLAPSED_SIDEBAR_WIDTH = 27


@pytest.mark.order(after='test_webext_loads')
class TestSidebarDisplay:

    @staticmethod
    def test_default_hidden(controller, unique_reader):
        unique_reader.home()
        assert controller.sidebar.loaded

        # Ensures that the size is reduced to avoid overlapping on the page
        # -> This guarantees that the users can continue clicking on the page's
        # button when the sidebar is hidden.
        size = controller.sidebar.size
        assert size['height'] == COLLAPSED_SIDEBAR_HEIGHT and size['width'] == COLLAPSED_SIDEBAR_WIDTH

        # Ensures that the content of the sidebar is hidden
        assert controller.sidebar.hidden

    @staticmethod
    @pytest.mark.order(after='test_default_hidden')
    def test_displayed(controller, unique_reader):
        unique_reader.home()
        assert controller.sidebar.loaded

        if controller.sidebar.hidden:
            controller.sidebar.toggle()

        controller.sidebar.wait_for_text('<', 'hide-but')

        # Ensures that the size is expanded (as opposed to reduced when hidden)
        # Otherwise, the display won't be clearly visible for the user
        size = controller.sidebar.size
        assert size['height'] > COLLAPSED_SIDEBAR_HEIGHT and size['width'] == SIDEBAR_WIDTH

        # Ensures that the content of the sidebar is hidden
        assert not controller.sidebar.hidden

    @staticmethod
    @pytest.mark.order(after='test_default_hidden')
    def test_toggle(controller, unique_reader):
        unique_reader.home()
        assert controller.sidebar.loaded

        # Ensures that the content of the sidebar is toggled
        init_state = controller.sidebar.hidden
        controller.sidebar.toggle()
        assert init_state != controller.sidebar.hidden
        controller.sidebar.toggle()
        assert init_state == controller.sidebar.hidden

    @staticmethod
    @pytest.mark.order(after='test_toggle')
    def test_open_persistence(controller, unique_reader):
        unique_reader.home()
        assert controller.sidebar.loaded

        # Ensures that the content of the sidebar is toggled
        state = controller.sidebar.hidden
        controller.sidebar.toggle()
        new_state = controller.sidebar.hidden
        assert state != new_state
        state = new_state

        # Load again and check sidebar state persistence (opened)
        unique_reader.home()
        controller.refresh()
        assert controller.sidebar.loaded
        new_state = controller.sidebar.hidden
        assert state == new_state
        controller.sidebar.toggle()
        state = controller.sidebar.hidden

        # Load again and check sidebar state persistence (reduced)
        unique_reader.home()
        controller.refresh()
        assert controller.sidebar.loaded
        new_state = controller.sidebar.hidden
        assert state == new_state
