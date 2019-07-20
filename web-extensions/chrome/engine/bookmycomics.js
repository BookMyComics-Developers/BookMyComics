/* globals
    BmcDataAPI:readable
    BmcMessagingHandler:readable
    BmcUI:readable
    LOGS:readable
*/

const ENGINE_ID = 'BookMyComics::Engine';

/**
 * This class provides the internal logic for the extension.
 * Depending on the method, it can optionally spawn an UI element, or generate
 * events.
 *
 * @class BmcEngine
 */
function BmcEngine(hostOrigin, readerName, comicInfo) {
    this._hostOrigin = hostOrigin;
    this._db = new BmcDataAPI();
    LOGS.log('S14', {'elem': 'BmcDataAPI'});
    this._messaging = new BmcMessagingHandler(this._hostOrigin);
    LOGS.log('S14', {'elem': 'BmcMEssagingHandler'});
    this._ui = new BmcUI(this._messaging, this._db);
    LOGS.log('S14', {'elem': 'BmcUI'});

    // Re-use DOM-style events by using a null-text node underneath
    this._eventCore = document.createTextNode(null);
    this.addEventListener = this._eventCore.addEventListener.bind(this._eventCore);
    this.removeEventListener = this._eventCore.removeEventListener.bind(this._eventCore);
    this.dispatchEvent = this._eventCore.dispatchEvent.bind(this._eventCore);

    // Setup listeners for messages, which should be directly handled by the core.
    //
    // Handle "Register"
    this._messaging.addWindowHandler(
        ENGINE_ID,
        evData => evData.type === 'action' && evData.action === 'register',
        evData => {
            this.register(evData.label, err => {
                let retErr = null;
                if (err) {
                    retErr = new Error(LOGS.getString('E0010', {'label': evData.label,
                                                                'err': err.message}));
                }
                // FIXME: Register a .once callback on the memoization completion, which would call
                // this method so the last parameter can be an id (as it should be).
                this.sendNotificationWithComicInfo('Register Comic', retErr, evData.label);
            });
        });
    // Handle "Alias"
    this._messaging.addWindowHandler(
        ENGINE_ID,
        evData => evData.type === 'action' && evData.action === 'alias',
        evData => {
            this.alias(evData.id, err => {
                let retErr = null;
                if (err) {
                    retErr = new Error(LOGS.getString('E0011', {'id': evData.id,
                                                                'err': err.message}));
                }
                this.sendNotificationWithComicInfo('Alias Comic', retErr, evData.id);
            });
        });
    // Handle "Delete"
    this._messaging.addWindowHandler(
        ENGINE_ID,
        evData => evData.type === 'action' && evData.action === 'delete',
        evData => {
            this.delete(
                evData.comic.id,
                (evData.source || {}).reader,
                (evData.source || {}).name,
                err => {
                    let retErr = null;
                    if (err) {
                        retErr = new Error(LOGS.getString('E0017', {
                            kind: evData.source ? 'Source' : 'Comic',
                            reason: err.message,
                        }));
                    }
                    this._ui.refreshSidePanel();
                    const kind = evData.source ? 'Comic Source' : 'Comic';
                    this._ui.makeNotification(`Delete ${kind}`, retErr);
                });
        });
    // Handle "URLOpen"
    this._messaging.addWindowHandler(
        ENGINE_ID,
        evData => evData.type === 'action' && evData.action === 'urlopen',
        evData => {
            window.location.replace(evData.url);
        });

    // A bit of stateful data, so that we can avoid re-checking the storage
    // everytime (and thus speed-up a bit the logic that spawn the UI bits)
    let sanitizedInfo = comicInfo || { common: {} };
    this._comic = {
        reader: readerName,
        info: sanitizedInfo,
        name: sanitizedInfo.common.name,
        chapter: sanitizedInfo.common.chapter,
        page: sanitizedInfo.common.page,
        id: undefined,
        memoizing: false,
    };
    // Only when relevant, setup the listeners for internal events,
    // and launch the asynchronous necessary loads
    if (this._comic.name) {
        // utility that will remember the comic ID and serve as a cache
        this._memoizeComic();
    }
}

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
 */
BmcEngine.prototype._memoizeComic = function () {
    if (this._comic.name === undefined
        || this._comic.name === null
        || typeof this._comic.name !== 'string'
        || this._comic.name === '') {
        LOGS.warn('E0001');
        return;
    }
    if (this._comic.id !== undefined) {
        // console.log(`BmcEngine._memoizeComic: Cache Hit (${this._comic.id}).`);
        this._dispatchLoad();
        return ;
    }
    if (this._comic.memoizing) {
        // console.log('BmcEngine._memoizeComic: Memoize request already pending.');
        return ;
    }
    this._comic.memoizing = true;
    this._db.findComic(this._comic.reader, this._comic.name, (err, comicId) => {
        // console.log('BmcEngine._memoizeComic: memoized id=', comicId);
        this._comic.id = comicId;
        this._comic.memoizing = false;
        this._dispatchLoad();
    });
};

BmcEngine.prototype._forceMemoizeComic = function () {
    // If memoization is ongoing, wait for the end of it before forcing a new
    // memoization.
    if (this._comic.memoizing) {
        LOGS.log('S3');
        this.addEventListener(this.events.load, () => this._forceMemoizeComic(), {once: true});
        return this._memoizeComic();
    }

    LOGS.log('S4');
    // Now that we're sure no memoization is ongoing, reset the memoized ID,
    // and restart memoization
    this._comic.id = undefined;
    if (this._comic.name) {
        this.addEventListener(this.events.load, () => {
            LOGS.log('S5');
        }, {once: true});
        this._memoizeComic();
    }
};

/*
 * This function is the main window's entry point to setup the add-on's
 * necessary utilities (UI, background process, etc.)
 * It requires the current page's comis info, for any UI that might need to be
 * spawned and would require it.
 *
 */
BmcEngine.prototype.setup = function() {
    return this._ui.makeSidePanel(
        () => this.track(),
        this._hostOrigin);
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
    if (!this._comic.name) {
        LOGS.log('S6');
        return ;
    }
    LOGS.log('S7', {'manga': this._comic.name,
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
    this._memoizeComic();
};

/*
 * This function registers a comic into the saved data. It shall be used by the
 * user-interacting UI spawned on an online reader's page.
 *
 * @param {String} label - the Comic's user-defined label
 *
 * @return {undefined}
 */
BmcEngine.prototype.register = function(label, cb) {
    LOGS.log('S10', {'label': label,
                     'reader': this._comic.reader,
                     'manga': this._comic.name,
                     'chapter': this._comic.chapter,
                     'page': this._comic.page});
    return this._db.registerComic(label, this._comic.reader, this._comic.info, err => {
        LOGS.debug('S11', {'err': err});
        if (!err) {
            this._forceMemoizeComic();
        }
        return cb(err);
    });
};

/*
 * This function registers a new name for an existing comic into the saved data.
 * Then, it also updates the progress of reading for this comic.
 *
 * @param {Number} comicId - Unique comic ID
 *
 * @return {undefined}
 */
BmcEngine.prototype.alias = function(comicId, cb) {
    LOGS.log('S12', {'comicId': comicId,
                     'reader': this._comic.reader,
                     'manga': this._comic.name});
    return this._db.aliasComic(comicId, this._comic.reader, this._comic.info, err => {
        if (!err) {
            this._forceMemoizeComic();
        }
        return cb(err);
    });
};

/*
 * This function deletes a Source from a comic or a whole Comic, given a comic
 * ID, and an optional reader and name.  If the deleted source was the last
 * source associated to the Comic, the Comic will be deleted along with its
 * last Source.
 *
 * @param {Number} comicId - Unique comic ID
 * @param {String} reader - Name of the source's reader
 * @param {String} name - Name of the comic within the reader
 *
 * @return {undefined}
 */
BmcEngine.prototype.delete = function(comicId, reader, name, cb) {
    LOGS.debug('S60', { id: comicId, reader, name });

    // Common completion closure which forces memoization (in case we just
    // removed the Comic/Source matching the current page)
    const completeDelete = err => {
        if (!err) {
            this._forceMemoizeComic();
        }
        return cb(err);
    };
    // Both reader and name must be defined to identify a source according to
    // engine/datamodel.js
    // As such, if either is undefined, assume we're targeting the whole comic
    if (!reader || !name) {
        return this._db.unregisterComic(comicId, completeDelete);
    }
    // Otherwise, remove the source (and optionally the Comic if it was the
    // last source)
    return this._db.unaliasComic(comicId, reader, name, completeDelete);
};

BmcEngine.prototype.sendNotificationWithComicInfo = function(event, err, id) {
    this._ui.makeNotification(event, err,
                              {'comicId': id,
                               'comicSource': this._comic.reader,
                               'comicName': this._comic.name,
                              });
};
