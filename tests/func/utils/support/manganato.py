import random

from selenium.common.exceptions import NoSuchElementException, StaleElementReferenceException, WebDriverException
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains

from . import SupportBase
from .. import RetriableError, retry, retry_on_ex, check_predicate

class MangaNatoDriver(SupportBase):
    name = "manganato"

    def __init__(self, *args, **kwargs):
        super(MangaNatoDriver, self).__init__(*args, **kwargs)

    def _get_mangas(self):
        # First, go to the website
        self.home()
        # Retrieve the generated random link, which is generated after loading the page
        return self._driver.find_elements(by=By.CLASS_NAME, value='content-homepage-item')

    def home(self):
        """
            Loads the homepage of the reader
        """
        self._driver.get('https://manganato.com/')

    @retry(abort=True)
    @check_predicate(RetriableError, "Could not load random comic")
    def load_random(self):
        to_ignore = []

        mangas = self._get_mangas()
        while len(mangas) > 0:
            manga = mangas.pop(random.randrange(len(mangas)))
            chapters = manga.find_elements(by=By.CSS_SELECTOR, value='.item-chapter>a')
            if len(chapters) < 3:
                continue
            href = chapters[1].get_attribute('href')
            if (('://manganato.com/' not in href and '://chapmanganato.com/' not in href)
                    or href in to_ignore):
                continue
            url_parts = [p for p in href.split('/') if p]
            if len(url_parts[-1].split('-')[-1].split('.')) > 1:
                continue
            self._driver.get(href)
            return

        raise RuntimeError("No manga with enough chapters nor with link on manganelo")

    def has_prev_page(self):
        return bool(self._driver.find_elements(
            by=By.CSS_SELECTOR,
            value='.navi-change-chapter-btn>.navi-change-chapter-btn-prev'))

    @retry_on_ex([StaleElementReferenceException, WebDriverException])
    def prev_page(self):
        # In case you wonder, yes, button with "next" class is actually to go to the previous
        # chapter, because why not!
        btn = self._driver.find_element(
            by=By.CSS_SELECTOR,
            value='.navi-change-chapter-btn>.navi-change-chapter-btn-prev')
        btn.click()

    def has_next_page(self):
        return bool(self._driver.find_elements(
            by=By.CSS_SELECTOR,
            value='.navi-change-chapter-btn>.navi-change-chapter-btn-next'))

    @retry_on_ex([StaleElementReferenceException, WebDriverException])
    def next_page(self):
        # In case you wonder, yes, button with "back" class is actually to go to the next
        # chapter, because why not!
        btn = self._driver.find_element(
            by=By.CSS_SELECTOR,
            value='.navi-change-chapter-btn>.navi-change-chapter-btn-next')
        btn.click()

    def get_comic_name(self):
        """
            Extracts the comic name from the current URL
        """
        url = self._driver.current_url
        if 'chapmanganato.com' not in url:
            return None
        parts = self._driver.find_elements(
            by=By.CSS_SELECTOR,
            value=".panel-breadcrumb > .a-h")
        if len(parts) < 2:
            return None
        return parts[1].text

    def get_chapter(self):
        """
            Returns the chapter number of the current loaded page.
        """
        parts = [p for p in self._driver.current_url.split('/') if p]
        return parts[-1].split('-')[-1]

    @staticmethod
    def get_page():
        """
            Returns the page number of the current loaded page.
            As Manganato does not offer per-page browsing, we always return
            None
        """
        return None
