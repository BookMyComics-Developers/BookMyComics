/* globals
    LOCALIZATION:readable
    LOGS:readable
*/

/**
 * This class handles the keyScheme for all data stored by BookMyComics
 * It relies on a persistent "state", stored and retrieved using the Storage
 * class.
 *
 * Currently, three types of data are available:
 * 1. state: internal add-on state, maintained to make operations easier along
 *           the lifecycle of the extension.
 * 2. map: Dictionary of names of Comic that maps to Comic ids
 * 3. comic: Stores all data relevant to a tracked comic:
 *    > id: id of the comic (used to find this object in the storage)
 *    > chapter: Chapter number of the last page read
 *    > page: Page number of the last page read. Can be null (to
 *            support full-chapter mode readers).
 *
 * @class KeyScheme
 *
 * @param {Storage} storage - the storage manager object
 */
function KeyScheme(storage) {
    this._storage = storage;
}

KeyScheme.prototype.BMC_STATE_KEY = 'BookMyComics.state';
KeyScheme.prototype.BMC_MAP_KEY = 'BookMyComics.map';
KeyScheme.prototype.BMC_KEY_PREFIX = 'BookMyComics.comics';

/**
 * @callback KeyScheme~getMapCb
 * @param {Error} err - Error object returned by the failing layer
 * @param {Object} map - Name-to-Id mapping object from the storage
 */

/**
 * This function retrieves the Name-to-Id mapping from the storage,
 * in order to allow manipulating it and update it in an atomic-like manner
 * within other functions/classes.
 *
 * @param {KeyScheme~getMapCb} cb
 *
 */
KeyScheme.prototype.getMap = function(cb) {
    const keyToGet = {};
    keyToGet[this.BMC_MAP_KEY] = {};
    return this._storage.get(keyToGet, (err, data) => {
        if (err) {
            LOGS.log('S16');
            return cb(err, null);
        }
        return cb(null, data[this.BMC_MAP_KEY]);
    });
};

/**
 * @callback KeyScheme~nextIdCb
 * @param {Error} err - Error object returned by the failing layer
 * @param {Number} id - Unique ID for the Comic to be registered
 */

/**
 * This function returns a unique ID, guaranteed unused, for the calling code
 * to register a new Comic under this ID.
 * It automatically updates an internal (persistent) state, keeping track of
 * the last IDs attributed, thus simulating an auto-increment style SQL ID.
 *
 * @param {KeyScheme~nextIdCb} cb
 *
 */
KeyScheme.prototype.nextId = function(cb) {
    const keyToGet = {};
    keyToGet[this.BMC_STATE_KEY] = { lastId: -1 };
    return this._storage.get(keyToGet, (err, state) => {
        if (err) {
            return cb(err, null);
        }
        const newState = { lastId: state[this.BMC_STATE_KEY].lastId + 1};
        const dataset = {};
        dataset[this.BMC_STATE_KEY] = newState;
        this._storage.set(dataset, err => {
            if (err) {
                return cb(err, null);
            }
            return cb(null, newState.lastId);
        });
    });
};

/**
 * This function computes the actual storage key matching a given Unique Comic
 * ID.
 *
 * @param {Number} comicId - Unique ID of the registered Comic
 *
 * @return {String} Storage key matching the comicId
 *
 */
KeyScheme.prototype.keyFromId = function(comicId) {
    return `${this.BMC_KEY_PREFIX}.${comicId}`;
};

/**
 * @callback KeyScheme~idFromSourcecCb
 * @param {Error} err - Error object returned by the failing layer
 * @param {Number|null} id - Unique ID of the registered Comic. Set to null if
 *                           the comic is not registered.
 */

/**
 * This function looks-up into the Name-to-Id mapping (retrieved from the
 * storage), in order to resolve the Unique ID associated to a Comic name.
 * If the Comic cannot be found, null is provided to the callback.
 *
 * @param {BmcComicSource} source - The source to look the comic for
 * @param {KeyScheme~idFromSourceCb} cb
 *
 */
KeyScheme.prototype.idFromSource = function(source, cb) {
    const keyToGet = {};
    keyToGet[this.BMC_MAP_KEY] = {};
    this._storage.get(keyToGet, (err, data) => {
        if (err) {
            return cb(err, null);
        }
        const mapping = data[this.BMC_MAP_KEY];
        const skey = this.computeSourceKey(source);
        let id = null;
        if (mapping[skey] !== undefined) {
            id = mapping[skey].id;
        }
        return cb(null, id);
    });
};

/**
 * This function computes a storage mapping key for a given source reader/comic
 *
 * @param {BmcComicSource} source - the BmcComicSource object
 *
 * @returns {string} the computed key for the provided source info
 */
KeyScheme.prototype.computeSourceKey = function(source) {
    return source.serialize();
};

/**
 * This class represents a source  of a comic, namely the set of informations
 * identifying where a comic can be read from, including but not
 * exhaustively:
 *  - How the name is serialized in the source OnlineReader
 *  - Name of the OnlineReader
 *
 * @class
 *
 * @param {string} name - how the comic's name is serialized in the URLs of
 *                        this source
 * @param {string} reader - name of the source reader
 * @param {Object} info - custom per-reader info allowing to re-generate an URL
 *                        for a comic
 */
function BmcComicSource(name, reader, info) {
    this.name = name;
    this.reader = reader;
    this.info = Object.assign({}, info);
}

/**
 * This method serializes the object into a basic object fit for writing into
 * the storage.
 *
 * @method
 *
 * @return {object}
 */
BmcComicSource.prototype.serialize = function() {
    // Ensure ordre by using a template string.
    return JSON.stringify(this, ['reader', 'name']);
};

/**
 * This method deserializes an object from the data storage into acomplete,
 * usable JS object with utility methods.
 *
 * @method
 *
 * @param {string} key - The key for the source (serialized BmcComicSource)
 * @param {Object} readerInfo - the reader's custom info for rebuilding an URL
 *                              for a tracked manga.
 *
 * @return {BmcComicSource}
 */
BmcComicSource.deserialize = function(key, readerInfo) {
    const obj = JSON.parse(key);
    return new BmcComicSource(obj['name'], obj['reader'], readerInfo);
};

/**
 * This method compares the BmcComicSource object with the matching raw data,
 * to tell whether both have the same values or not.
 *
 * @method
 *
 * @param {BmcComicSource} source - The source object to compare with
 *
 * @returns {boolean} whether the two sources match
 */
BmcComicSource.prototype.is = function(source) {
    return this.name == source.name && this.reader == source.reader && this.info === source.info;
};




/**
 * This class represents all the data handled for one comic, including all the
 * various registered sources, the label and the current tracking status.
 *
 * @class
 *
 * @param {string} label - the display label identifying the comic entry
 * @param {number} id - the unique comic id for this comic
 * @param {number} chapter - the last chapter read
 * @param {number|undefined} page - the last page read
 * @param {BmcComicSource[]} sources - the array of sources objects for
 *                                     this comic
 */
function BmcComic(label, id, chapter, page, sources) {
    this.label = label;
    this.id = id;
    this.chapter = chapter;
    this.page = page;
    this._sources = [];
    if (sources) {
        this._sources = sources.splice(0);
    }
}

/**
 * This method serializes the object into a basic object fit for writing into
 * the storage.
 *
 * @method
 *
 * @return {object}
 */
BmcComic.prototype.serialize = function() {
    return {
        label: this.label,
        id: this.id,
        tracking: {
            chapter: this.chapter,
            page: this.page,
        },
    };
};

/**
 * @callback BmcComic~iterCb
 *
 * @param {BmcComicSource}
 *
 * @return {undefined}
 */
/**
 * This method loops over sources.
 *
 * @param {BmcComic~iterCb} iterFunc - The callback to be called on each source.
 *
 */
BmcComic.prototype.iterSources = function(iterFunc) {
    if (!iterFunc) {
        return;
    }
    for (var i = 0; i < this._sources.length; ++i) {
        iterFunc(this._sources[i]);
    }
};

/**
 * This method return the matching source (comparison being performed on the
 * reader) or `null` if no match was found.
 *
 * @param {string} sourceReader - The reader of the source we want to get.
 *
 * @return {BmcComicSource}
 *
 */
BmcComic.prototype.getSource = function(sourceReader) {
    const match = this._sources.find(source => source.reader === sourceReader);
    if (typeof match === 'undefined') {
        return null;
    }
    return match;
};

/**
 * This method deserializes an object from the data storage into acomplete,
 * usable JS object with utility methods.
 *
 * @method
 *
 * @param {object} obj - The basic object from the data storage
 *
 * @return {BmcComic}
 */
BmcComic.deserialize = function(obj) {
    return new BmcComic(
        obj['label'],
        obj['id'],
        obj['tracking']['chapter'],
        obj['tracking']['page']);
};

/**
 * This method overrides the comic entry's existing label with the one provided
 * as parameter.
 *
 * @method
 *
 * @param {string} label - the new label for the comic entry
 */
BmcComic.prototype.setLabel = function(label) {
    this.label = label;
};

/**
 * This method overrides the comic entry's existing label with the one provided
 * as parameter.
 *
 * @method
 *
 * @param {number} chapter - the last chapter read
 * @param {number|undefined} page - the last page read
 */
BmcComic.prototype.setProgress = function(chapter, page) {
    this.chapter = chapter;
    this.page = page;
};

/**
 * This function adds a new source to the existing collection of sources
 * contained by the BmcComic object.
 * If the source already exists, a warning message is logged, and `false` is
 * returned
 *
 * @method
 *
 * @param {BmcComicSource} name - how the comic's name is serialized in the URLs of
 *                        this source
 *
 * @return {boolean} true - The source was added to the BmcComic object
 *                   false - The source already existed within the BmcComic
 *                           object
 */
BmcComic.prototype.addSource = function(source) {
    const found = this._sources.find(owned => owned.is(source));
    if (found) {
        LOGS.warn('E0009', {'data': JSON.stringify(source.serialize())});
        return false;
    }
    this._sources.push(source);
    return true;
};



/**
 * This class handles storing, retrieving and searching for data about the
 * Manga/Comics handled by the add-on.
 * It provides a unified interface, which handles both FireFox and
 * Chrome-style APIs.
 *
 * The information about tracked comics is stored using 2 distinct types of
 * objects:
 *
 * @class BmcDataAPI
 */
function BmcDataAPI() {
    this._data = new Storage();
    this._scheme = new KeyScheme(this._data);
}


/**
 * @callback BmcDataAPI~findCb
 * @param {Error} err - Error object returned by the failing layer
 * @param {Number|null} id - Unique ID of the registered Comic. Set to null if
 *                           the comic is not registered.
 */

/**
 * This function looks-up into the extension's storage to find the Unique ID
 * matching the requested comic name.
 * If the comic name cannot be found in the storage, null is returned as the
 * id, indicating that the comic can either be aliased to an existing
 * registered comic, or that it can be registered as a new entry.
 *
 * @param {String} readerName - Name of the reader to look-up
 * @param {String} comicName - Name of the comic to look-up
 * @param {BmcDataAPI~findCb} cb
 *
 */
BmcDataAPI.prototype.findComic = function(readerName, comicName, cb) {
    let source = new BmcComicSource(comicName, readerName);
    return this._scheme.idFromSource(source, (err, id) => {
        if (err) {
            LOGS.log('S18', {'data': JSON.stringify(err)});
            return cb(err, null);
        }
        LOGS.log('S19', {'data': JSON.stringify(id)});
        return cb(null, id === undefined ? null : id);
    });
};


/**
 * @callback BmcDataAPI~updateCb
 * @param {Error} err - Error object returned by the failing layer
 */

/**
 * This function updates a registered Comic's tracking payload.
 * It must only be used to update known and existing registered Comics, and
 * will fail if the payload cannot be found. Tje Unique id is not checked for
 * validity.
 *
 * @param {Number} comicId - Unique ID of the registered Comic
 * @param {Number} chapter - Chapter number of the last page read
 * @param {Number} page - Page number of the last page read
 * @param {BmcDataAPI~updateCb} cb
 *
 */
BmcDataAPI.prototype.updateComic = function(comicId, chapter, page, cb) {
    const comicKey = this._scheme.keyFromId(comicId);
    return this._data.get(comicKey, (err, data) => {
        if (err) {
            LOGS.log('S20', {'data': JSON.stringify(err)});
            return cb(err);
        }
        if (!data) {
            return cb(new Error(LOCALIZATION.getString('S21')));
        }
        const payload = Object.assign({}, data[comicKey]);
        /*
         * XXX TODO FIXME
         * improve logic here, as this allows skipping many pages/chapters at
         * once. We may actually want to accept that, though.
         * Similarly, we may want to allow backwards-tracking too.. ?
         */
        if (payload.tracking.chapter !== undefined) {
            var trackPage = 0;
            if (payload.tracking.page !== undefined) {
                trackPage = parseInt(payload.tracking.page);
            }
            const trackChapter = parseInt(payload.tracking.chapter);
            const currentChapter = parseInt(chapter);
            var currentPage = 0;
            if (typeof page !== 'undefined') {
                currentPage = parseInt(page);
            }

            if (trackChapter > currentChapter ||
                    (trackChapter === currentChapter && trackPage > currentPage)) {
                LOGS.warn('S22');
                // We're at an earlier point in the manga than what's stored so we leave
                // earlier while ensuring we're not growing the stack.
                return setTimeout(() => cb(null), 0);
            }
        }
        // Re-tracking the last tracked page; Reload ? OR clicked on last read ?
        // anyways -> Early return, while ensuring we're not growing the stack.
        if (payload.tracking.chapter === chapter && payload.tracking.page === page) {
            return setTimeout(() => cb(null), 0);
        }
        if (typeof chapter === 'undefined') {
            return cb(new Error(LOGS.getString('E0019', {chapter, page})));
        }
        payload.tracking.chapter = chapter;
        payload.tracking.page = page;
        const dataset = {};
        dataset[comicKey] = payload;
        return this._data.set(dataset, err => {
            if (err) {
                LOGS.log('S23', {'data': JSON.stringify(err)});
                return cb(err);
            }
            LOGS.log('S24', {'comicId': comicId});
            return cb(null);
        });
    });
};


/**
 * @callback BmcDataAPI~registerCb
 * @param {Error} err - Error object returned by the failing layer
 */

/**
 * This function registers a Comic into the extension's storage.
 * An unique ID is computed at the registration time, and the registration
 * allows setting a chapter and a page rather than requiring a
 * post-registration update.
 *
 * The registration includes:
 *  - Addition of the name->id mapping into the KeyScheme's map
 *  - Definition of the tracking payload for the Comic
 *
 * @param {String} label - the display name of the comic provided by the user
 * @param {String} readerName - Name of the Reader to register as the source
 * @param {Object} comicInfo - Object containing all relevant information
 *                             relevant to a reader and how to read the comic
 *                             on it. It might contain more than only the
 *                             required 'common' member.
 * @param {Object} comicInfo.common - Object containing common properties about
 *                                    a tracked comic.
 * @param {String} comicInfo.common.name    - Name of the Comic to register
 * @param {Number} comicInfo.common.chapter - Chapter number of the last page
 *                                            read
 * @param {Number} comicInfo.common.page    - Page number of the last page read

 * @param {BmcDataAPI~registerCb} cb
 *
 */
BmcDataAPI.prototype.registerComic = function(label, readerName, comicInfo, cb) {
    return this._scheme.nextId((err, id) => {
        if (err) {
            LOGS.log('S25', {'data': JSON.stringify(err)});
            return cb(err);
        }
        return this._scheme.getMap((err, map) => {
            const comic = new BmcComic(label, id, comicInfo.common.chapter, comicInfo.common.page);

            const comicKey = this._scheme.keyFromId(id);
            const dataset = {};
            dataset[comicKey] = comic.serialize();

            const readerInfo = Object.assign({}, comicInfo);
            delete readerInfo.common;
            const source = new BmcComicSource(comicInfo.common.name, readerName, readerInfo);
            const sourceKey = this._scheme.computeSourceKey(source);
            map[sourceKey] = { id, info: readerInfo };
            dataset[this._scheme.BMC_MAP_KEY] = map;

            return this._data.set(dataset, err => {
                return cb(err);
            });
        });
    });
};


/**
 * @callback BmcDataAPI~aliasCb
 * @param {Error} err - Error object returned by the failing layer
 */

/**
 * This function allows attaching a new Comic name to an existing registered
 * and tracked comic.
 * This is done through the update of the name/id mapping from the KeyScheme.
 *
 * @param {Number} comicId - Unique ID of the registered Comic
 * @param {String} readerName - Name of the Reader to register as the aliased source
 * @param {Object} comicInfo - Object containing all information relevant to a
 *                             reader and how to read the comic on it. It might
 *                             contain more than only the required 'common'
 *                             attributes.
 * @param {Object} comicInfo.common - Object containing common properties about
 *                                    a tracked comic.
 * @param {String} comicInfo.common.name    - Name of the Comic to register
 * @param {Number} comicInfo.common.chapter - Chapter number of the last page
 *                                            read
 * @param {Number} comicInfo.common.page    - Page number of the last page read
 * @param {BmcDataAPI~aliasCb} cb
 */
BmcDataAPI.prototype.aliasComic = function(comicId, readerName, comicInfo, cb) {
    return this._scheme.getMap((err, map) => {
        const readerInfo = Object.assign({}, comicInfo);
        delete readerInfo.common;
        const source = new BmcComicSource(comicInfo.common.name, readerName, readerInfo);
        const sourceKey = this._scheme.computeSourceKey(source);
        map[sourceKey] = { id: comicId, info: readerInfo };
        const dataset = {};
        dataset[this._scheme.BMC_MAP_KEY] = map;
        return this._data.set(dataset, err => {
            return cb(err);
        });
    });
};


/**
 * @callback BmcDataAPI~unregisterCb
 * @param {Error} err - Error object returned by the failing layer
 */

/**
 * This function allows unregistering a comic, in a fail-safe manner.
 * The mapping allowing to find the Id from the Comic name and aliases is
 * cleaned first, so that the id cannot be resolved anymore, and then, the
 * tracking payload is cleaned-up, as it has become unreachable.
 *
 * This prevents an intermediate failure from creating an inconsistent dataset
 * (ie: make a resolvable id point towards removed data).
 *
 * @param {Number} comicId - Unique ID of the registered Comic
 * @param {BmcDataAPI~unregisterCb} cb
 */
BmcDataAPI.prototype.unregisterComic = function(comicId, cb) {
    // First, delete all links from the map
    return this._scheme.getMap((err, map) => {
        Object.keys(map).forEach(key => {
            if (map[key].id === comicId) {
                delete map[key];
            }
        });
        const dataset = {};
        dataset[this._scheme.BMC_MAP_KEY] = map;
        return this._data.set(dataset, err => {
            if (err) {
                return cb(err);
            }
            // All links are now cleaned-up, we can remove the comic's
            // remaining artifact.
            const comicKey = this._scheme.keyFromId(comicId);
            return this._data.remove(comicKey, err => {
                return cb(err);
            });
        });
    });
};


/**
 * @callback BmcDataAPI~unaliasCb
 * @param {Error} err - Error object returned by the failing layer
 */

/**
 * This function allows unaliasing a Source from a Comic, in an inclusive
 * manner. If the unaliased Source is the last Source for the Comic, then the
 * Comic itself is removed using the fail-safe unregisterComic method.
 * If not, the Source is simply removed from the list of available Sources.
 *
 * This prevents an intermediate failure from creating an inconsistent dataset
 * (ie: make a resolvable id point towards removed data).
 *
 * @param {Number} comicId - Unique ID of the registered Comic
 * @param {String} reader - Name of the source's reader
 * @param {String} name - Name of the comic within the reader
 * @param {BmcDataAPI~unaliasCb} cb
 *
 * @return {undefined}
 */
BmcDataAPI.prototype.unaliasComic = function(comicId, reader, name, cb) {
    return this._scheme.getMap((err, map) => {
        // First, count the number of Sources for one Comic
        // On the way, check if the source to be removed is still part of the
        // dataset (it might have been removed through another tab, rendering
        // the current sideBar content out-of-sync)
        let sourceFound = false;
        const sourceCount = Object.keys(map).reduce((ctr, key) => {
            if (map[key].id === comicId) {
                // omit "info" parameter as we won't use the object being the
                // deserialization of the key.
                const source = BmcComicSource.deserialize(key);
                if (source.reader === reader && source.name === name) {
                    sourceFound = true;
                }
                return ctr + 1;
            }
            return ctr;
        }, 0);

        // If the source to be removed was not part of the dataset, notify an
        // error, and don't do anything more.
        if (!sourceFound) {
            return cb(new Error(LOGS.getString('E0018', {
                reader,
                name,
                id: comicId,
            })));
        }

        // Check if we need to delete the whole comic instead
        if (sourceCount === 1) {
            return this.unregisterComic(comicId, cb);
        }

        // Simply remove the source.
        const source = new BmcComicSource(name, reader, {});
        const sourceKey = this._scheme.computeSourceKey(source);
        delete map[sourceKey];
        const dataset = {};
        dataset[this._scheme.BMC_MAP_KEY] = map;
        return this._data.set(dataset, err => {
            return cb(err);
        });
    });
};

/**
 * This function is only meant to be used by the BmcDataAPI type to build the
 * comics list.
 */
function buildComicList(self, data, comicId) {
    // Ensure that we don't crash if data is undefined
    // -> No data found in the storage
    // -> Add-on was never used yet.
    const sanitizedData = data || {};
    // Build an inverse mapping; comicId -> sources list
    // Default to empty-object if no map found (never created yet)
    const map = sanitizedData[self._scheme.BMC_MAP_KEY] || {};
    const inverseMap = Object.keys(map).reduce((acc, key) => {
        const comicId = map[key].id;
        if (acc[comicId] === undefined) {
            acc[comicId] = [];
        }
        acc[comicId].push(BmcComicSource.deserialize(key, map[key].info));
        return acc;
    }, {});
    let keys = Object.keys(sanitizedData).filter(
        key => key.indexOf(self._scheme.BMC_KEY_PREFIX) !== -1
    );
    if (typeof comicId !== 'undefined') {
        keys = keys.filter(key => sanitizedData[key]['id'] === comicId);
    }
    // Directly use the inverse mapping to set all sources while creating
    // the BmcComic objects.
    return keys.map(key => {
        const comic = BmcComic.deserialize(sanitizedData[key]);
        if (inverseMap[comic.id]) {
            inverseMap[comic.id].forEach(source => {
                comic.addSource(source);
            });
        }
        return comic;
    });
}

/**
 * This method returns the complete list of tracked comics
 *
 * @method
 *
 * @returns {BmcComic[]}
 */
BmcDataAPI.prototype.list = function(cb) {
    this._data.get(null, (err, data) => {
        if (err) {
            return cb(err, null);
        }
        return cb(null, buildComicList(this, data));
    });
};

/**
 * This method returns the comic with the given name or `null`` if not found.
 *
 * @method
 *
 * @returns BmcComic
 */
BmcDataAPI.prototype.getComic = function(comicId, cb) {
    this._data.get(null, (err, data) => {
        if (err) {
            return cb(err, null);
        }
        const results = buildComicList(this, data, comicId);
        if (results.length === 0) {
            return cb(null, null);
        }
        return cb(null, results[0]);
    });
};
