import random

from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.common.by import By

from . import SupportBase
from .. import RetriableError, retry, check_predicate


class FanFoxNavBar:
    def __init__(self, driver_wrapper):
        self._wrapper = driver_wrapper
        self._driver = driver_wrapper.driver
        self._pages = None
        self._pageIdx = -1
        self._chapter_prev = None
        self._chapter_next = None
        self.update()

    def update(self):
        # pages = self._driver.find_elements(by=By.CSS_SELECTOR, value='div.pager-list-left > span > a')
        # chapters = self._driver.find_elements(by=By.CSS_SELECTOR, value='div.pager-list-left > a.chapter')
        pager = self._get_pager()
        if not pager:
            return False

        self._pages = pager.find_elements(by=By.CSS_SELECTOR, value='span > a')
        chapters = pager.find_elements(by=By.CSS_SELECTOR, value='a.chapter')
        self._chapter_prev = None
        self._chapter_next = None
        for button in chapters:
            if "Pre" in button.text:
                self._chapter_prev = button
            if "Next" in button.text:
                self._chapter_next = button

        self._pageIdx = self._get_current_page_idx()
        return True

    def _get_pager(self):
        pagers = self._driver.find_elements(by=By.CLASS_NAME, value='pager-list-left')
        for i in range(len(pagers)):
            if pagers[i].get_property('childElementCount') > 0:
                pager = pagers[i]
                return pager
        return None

    def _get_current_page_idx(self):
        curPageIdx = -1
        for i in range(len(self._pages)):
            if 'active' in self._pages[i].get_attribute('class'):
                curPageIdx = i
                break
        return curPageIdx

    def prev_chapter(self):
        if not self._chapter_prev:
            return False
        self._wrapper.ensure_click(self._chapter_prev)
        return self.update()

    def first_page(self):
        if not self._pages or self._pageIdx == 0:
            return False
        self._wrapper.ensure_click(self._pages[1])
        return self.update()

    def has_prev_page(self):
        return self._chapter_prev is not None

    def prev_page(self):
        if not self._pages or self._pageIdx <= 0:
            return False
        self._wrapper.ensure_click(self._pages[0])  # Click on the "<" button
        return self.update()

    def has_next_page(self):
        return ((self._pages is not None
                 and self._pageIdx < (len(self._pages)-1))
                or (self._chapter_next is not None
                    and self._chapter_next.get_attribute('href') != self._driver.current_url))

    def next_page(self):
        if not self._pages or self._pageIdx == (len(self._pages) - 1):
            return False
        self._wrapper.ensure_click(self._pages[len(self._pages) - 1])   # Click on the ">" button
        return self.update()

    def last_page(self):
        if not self._pages or self._pageIdx == (len(self._pages) - 1):
            return False
        self._wrapper.ensure_click(self._pages[len(self._pages) - 2])
        return self.update()

    def next_chapter(self):
        if not self._chapter_next:
            return False
        self._wrapper.ensure_click(self._chapter_next)
        return self.update()


class FanFoxDriver(SupportBase):
    name = "mangafox"

    def __init__(self, *args, **kwargs):
        super(FanFoxDriver, self).__init__(*args, **kwargs)
        self._navbar = FanFoxNavBar(self._wrapper)

    def home(self):
        """
            Loads the homepage of the reader
        """
        self._driver.get('https://fanfox.net')
        # Bypass a common popup acting as a layer on top of the page...
        try:
            self._driver.find_element(by=By.CSS_SELECTOR, value='.lb-win-con > a > img').click()
        except NoSuchElementException:
            # fine, we only need to handle it once
            pass

    @retry(abort=True)
    @check_predicate(RetriableError, "Could not load random comic")
    def load_random(self):
        # First, go to the website
        self.home()

        # Select a list of "candidate chapters links" (with the href values,
        # which prevents invalidating the candidates by loading a new page)
        mangas = self._driver.find_elements(by=By.CSS_SELECTOR, value='.manga-list-4-list > li')
        print(f'checking out {len(mangas)} mangas')
        candidates = []
        while len(mangas):
            manga = mangas.pop(random.randrange(len(mangas)))
            chapters = manga.find_elements(by=By.CSS_SELECTOR, value='.manga-list-4-item-part > li > a')
            # Guarantee that we take a chapter which has both a "prev" and a "next"
            if len(chapters) < 3:
                print('Skipping, not enough chapters')
                continue
            candidates.append(chapters[1].get_attribute('href'))

        # Check random candidates until they fit the bill:
        # - Same website (base url)
        # - Has a navigation bar
        print(f'checking out {len(candidates)} candidates')
        while len(candidates):
            candidate = candidates.pop(random.randrange(len(candidates)))
            self._driver.get(candidate)

            if self._driver.current_url == 'https://fanfox.net':
                print('Failed ? Still on homepage')
                continue
            print(self._driver.current_url)

            if len(self._driver.current_url.split('/')) != 7:
                print('Does not support URLS with volume part for now:'
                      f' {len(self._driver.current_url.split("/"))} parts')
                continue

            # Now, select a page which has both "next" and "prev" pages (ie:
            # neither first nor last), but first we need to ensure the DOM has been
            # properly updated, and that the required select is present (it's added
            # dynamically)
            try:
                pages = self._driver.find_elements(by=By.CSS_SELECTOR, value='div > div > span > a')
            except NoSuchElementException:
                print('Failed? No navbar')
                continue

            if len(pages) <= 2:
                # This might mean that we're looking at one-page chapters for the
                # manga. As the reader supports it, let's go with this.
                self._navbar.update()
            else:
                # Only retain half the links (the navigation buttons are present twice
                # in a page, on top of the scan and underneath it), and click on a
                # page link which is neither the first nor the last.
                pages = pages[0:int(len(pages)/2)]
                self._wrapper.ensure_click(pages[random.randrange(1, len(pages) - 2)])
                self._navbar.update()
            return
        raise RuntimeError("No manga with enough chapters nor with link on mangafox")

    def has_prev_page(self):
        return self._navbar.has_prev_page()

    def prev_page(self):
        if not self._navbar.prev_page():
            if self._navbar.prev_chapter():
                if not self._navbar.last_page():
                    print('Already at earliest page, cannot go to previous')
                    return

    def has_next_page(self):
        return self._navbar.has_next_page()

    def next_page(self):
        if not self._navbar.next_page():
            if not self._navbar.next_chapter():
                print('Already at latest chapter, cannot go to next')
                return

    def get_comic_name(self):
        """
            Extracts the comic name from the current URL
        """
        url = self._driver.current_url
        if 'fanfox.net' not in url:
            return None
        elem = self._driver.find_element(by=By.CSS_SELECTOR, value='.reader-header-title-1 > a')
        return elem.text

    def get_chapter(self):
        """
            Returns the chapter number of the current loaded page.
        """
        parts = [p for p in self._driver.current_url.split('/') if p]
        return parts[4].replace('c', '')

    def get_page(self):
        """
            Returns the page number of the current loaded page.
        """
        parts = [p for p in self._driver.current_url.split('/') if p]
        return parts[5]
