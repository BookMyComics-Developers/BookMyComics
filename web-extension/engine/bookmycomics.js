/* globals
    BmcStorageFactory:readable
    BmcDataAPI:readable
    BmcEntrypointMessagingHandler:readable
    BmcSources:readable
    BmcUI:readable
    LOGS:readable
    BmcSettings:readable
*/

const sources = new BmcSources();
const ENGINE_ID = 'BookMyComics::Engine';

/**
 * This class provides the internal logic for the extension.
 * Depending on the method, it can optionally spawn an UI element, or generate
 * events.
 *
 * @class BmcEngine
 */
function BmcEngine(hostOrigin) {
    this._hostOrigin = hostOrigin;
    this._messaging = new BmcEntrypointMessagingHandler(this._hostOrigin);
    LOGS.log('S14', {'elem': 'BmcMessagingHandler'});
    this._db = null;
    this._ui = null;
    this._settings = new BmcSettings();

    // Re-use DOM-style events by using a null-text node underneath
    this._eventCore = document.createTextNode(null);
    this.addEventListener = this._eventCore.addEventListener.bind(this._eventCore);
    this.removeEventListener = this._eventCore.removeEventListener.bind(this._eventCore);
    this.dispatchEvent = this._eventCore.dispatchEvent.bind(this._eventCore);

    // Setup listeners for messages, which should be directly handled by the core.
    // Handle "URLOpen"
    this._messaging.addHandler(
        ENGINE_ID,
        evData => evData.type === 'action' && evData.action === 'urlopen',
        evData => {
            window.location.replace(evData.url);
        });
    // Handle "Comic information query"
    this._messaging.addHandler(
        ENGINE_ID,
        evData => evData.type === 'query' && evData.action === 'Comic Information',
        () => {
            this.sendNotificationWithComicInfo('Comic Information', null);
        });
}

BmcEngine.prototype.refresh_comic = function() {
    const readerName = window.location.hostname;
    // The `href.slice()` is used to ensure we include the hash part in the provided URL
    const loc = window.location;
    var comic = sources.getInfos(loc.host, loc.href.slice(loc.origin.length), document.body);
    // Log about comic info retrieval
    if (comic !== null) {
        LOGS.log('S41', {'data': JSON.stringify({
            comic: comic.serialize(),
            source: comic.getSource(readerName).toDict(),
        })});
    } else {
        LOGS.error('E0022');
    }
    let sanitizedInfo = comic || null;

    // Reuse this._comic if already set
    if (this._comic) { // Update comic chapter/page without overriding tracking info
        this._comic.chapter = comic.chapter;
        this._comic.page = comic.page;
    } else { // Initial setup
        this._comic = sanitizedInfo;
        if (this._comic) {
            comic.id = undefined; // Set unresolved-marker value until we could resolved the id
        }
        this._reader = readerName;
        this._memoizing = false;
    }
};

/*
 * Dicts of constants (names) for the various events available through
 * BmcEngine
 */
BmcEngine.prototype.events = {
    load: 'engine.load',
};

/**
 * Utility function to dispatch the comicId load completion event.
 */
BmcEngine.prototype._dispatchLoad = function () {
    this.dispatchEvent(new CustomEvent(this.events.load));
};

/**
 * Utility function that loads the comic's ID if any, and memorizes/caches it
 * (hence memoize) to accelerate later requests.
 *
 * If a memoization (active loading) is ongoing, no new request will be made,
 * but the completion event will still notify the beforehand registered
 * eventListener that the comicId is resolved.
 * This method allows to offer an unique behavior based on event communication,
 * whether the comicId was already resolved or not.
 *
 * Note that in the case of update of the memoized information, this method
 * will handle stale data, unless it's forcefully refreshed.
 *
 */
BmcEngine.prototype._memoizeComic = function (force_refresh) {
    const source = this._comic ? this._comic.getSource(this._reader) : null;
    if (!source) {
        LOGS.warn('E0001');
        return;
    }
    if (!force_refresh && this._comic.id !== undefined) {
        // console.log(`BmcEngine._memoizeComic: Cache Hit (${this._comic.id}).`);
        this._dispatchLoad();
        return ;
    }
    if (this._memoizing) {
        // console.log('BmcEngine._memoizeComic: Memoize request already pending.');
        return ;
    }
    this._memoizing = true;
    this._db.findComic(source.reader, source.name, (err, comicId) => {
        // console.log('BmcEngine._memoizeComic: memoized id=', comicId);
        this._comic.id = comicId;
        this._memoizing = false;
        this._dispatchLoad();
        this.sendNotificationWithComicInfo();
    });
};

/*
 * This function is the main window's entry point to setup the add-on's
 * necessary utilities (UI, background process, etc.)
 * It requires the current page's comic info, for any UI that might need to be
 * spawned and would require it.
 *
 */
BmcEngine.prototype.setup = function() {
    this._settings.refresh((err) => {
        LOGS.log('S14', {'elem': 'BmcSettings'});
        if (err) {
            // TODO
            alert(LOGS.getString('', {err: err}));
            return ;
        }
        const storage_engine = BmcStorageFactory.new(null /* Let factory choose*/, this._settings);
        if (storage_engine === null)
            alert('BookMyComics could not find a working Storage Engine. Please check the settings.');
        this._db = new BmcDataAPI(storage_engine);
        LOGS.log('S14', {'elem': 'BmcDataAPI'});
        this._ui = new BmcUI(this._messaging, this._settings);
        LOGS.log('S14', {'elem': 'BmcUI'});

        // A bit of stateful data, so that we can avoid re-checking the storage
        // everytime (and thus speed-up a bit the logic that spawn the UI bits)
        this.refresh_comic();

        // Detect AJAX-driven URL/hash changes in order to trigger tracking on AJAX
        // browsing
        window.addEventListener('hashchange', () => {
            this.refresh_comic();
            this.track();
        });

        return this._ui.makeSidePanel(
            () => this.track(),
            this._hostOrigin);
    });
};

/*
 * This function is the entrypoint for a reader page, which spawns the right UI
 * piece according to the situation.
 *
 * The reader's page must send any available information relative to the
 * displayed comic (if any).
 *
 */
BmcEngine.prototype.track = function() {
    const source = this._comic ? this._comic.getSource(this._reader) : null;
    if (!this._comic) {
        LOGS.log('S6');
        return ;
    }
    LOGS.log('S7', {'manga': source.name,
                    'chapter': this._comic.chapter,
                    'page': this._comic.page});

    // One single way to handle this, whether the id was already memoized or
    // not: use the event handling.
    LOGS.warn('E0007', {'event': this.events.load});
    this.addEventListener(this.events.load, () => {
        LOGS.log('S9', {'id': this._comic.id});
        if (this._comic.id === null) {
            this._ui.makeRegisterDialog();
            return;
        }
        this._db.updateComic(
            this._comic.id, this._comic.chapter, this._comic.page,
            err => this.sendNotificationWithComicInfo('track', err));
    }, {once: true});

    // Now fire the load or cache hit, that shall trigger the previously
    // registered event listener
    this._memoizeComic(true);
};

BmcEngine.prototype.sendNotificationWithComicInfo = function(event, err) {
    const source = this._comic ? this._comic.getSource(this._reader) : null;
    this._ui.makeNotification(
        event,
        err,
        {
            'comic': this._comic ? this._comic.serialize() : null,
            'source': source ? source.toDict() : null,
        }
    );
};
