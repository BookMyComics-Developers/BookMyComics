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
    return this._storage.get(this.BMC_MAP_KEY, (err, data) => {
        if (err) {
            console.log('Scheme could not retrieve Comic map');
            return cb(err, null);
        }
        let map = {};
        if (data) {
            map = data;
        }
        return cb(null, map);
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
    return this._storage.get(this.BMC_STATE_KEY, (err, state) => {
        if (err) {
            return cb(err, null);
        }
        const nextId = state.lastId + 1;
        state.lastId += 1;
        this._storage.set(this.BMC_STATE_KEY, state, err => {
            if (err) {
                return cb(err, null);
            }
            return cb(null, nextId);
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
    return `${BMC_KEY_PREFIX}.${comicId}`;
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
    this._storage.get(this.BMC_MAP_KEY, (err, mapping) => {
        if (err) {
            return cb(err, null);
        }
        const skey = this.computeSourceKey(source);
        let id = null;
        if (mapping && mapping[skey] !== undefined) {
            id = mapping[skey];
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
}

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
 */
function BmcComicSource(name, reader) {
    this._name = name;
    this._reader = reader;
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
    return JSON.stringify({
        name: this._name,
        reader: this._reader,
    });
}

/**
 * This method deserializes an object from the data storage into acomplete,
 * usable JS object with utility methods.
 *
 * @method
 *
 * @param {string} str - The serialized BmcComicSource
 *
 * @return {BmcComicSource}
 */
BmcComicSource.deserialize = function(str) {
    const obj = JSON.parse(str);
    return new BmcComicSource(obj['name'], obj['reader']);
}

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
    return this._name == source._name && this._reader == source._reader;
}




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
    this._label = label;
    this._id = id;
    this._chapter = chapter;
    this._page = page;
    this._sources = [];
    if (sources) {
        this._sources = source.splice(0);
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
        label: this._label,
        id: this._id,
        tracking: {
            chapter: this._chapter,
            page: this_page,
        },
    };
}

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
}

/**
 * This method overrides the comic entry's existing label with the one provided
 * as parameter.
 *
 * @method
 *
 * @param {string} label - the new label for the comic entry
 */
BmcComic.prototype.setLabel = function(label) {
    this._label = label;
}

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
    this._chapter = chapter;
    this._page = page;
}

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
        console.warn('Cannot add already existing source: '
                     + JSON.stringify(source.serialize()));
        return false;
    }
    this._sources.push(source);
    return true;
}




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
    let source = new BmcComicSource(readerName, comicName);
    return this._scheme.idFromSource(source, (err, id) => {
        if (err) {
            console.log(`Got FIND error: ${JSON.stringify(err)}`);
            return cb(err, null);
        }
        console.log(`Found data: ${JSON.stringify(id)}`);
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
            console.log(`Could not find comicId: ${JSON.stringify(err)}`);
            return cb(err);
        }
        if (!data) {
            return cb(new Error('Could not find comic data'));
        }
        const payload = Object.assign({}, data);
        /*
         * XXX TODO FIXME
         * improve logic here, as this allows skipping many pages/chapters at
         * once.
         */
        if (payload.chapter > chapter
            || (payload.chapter == chapter
                && (payload.page && page && payload.page >= page))) {
            return cb(new Error('Cannot go backwards in comic'));
        }
        payload.chapter = chapter;
        payload.page = page;
        return this._data.set({comicKey: payload}, err => {
            if (err) {
                console.log(`Got Update error: ${JSON.stringify(err)}`);
                return cb(err);
            }
            console.log(`Updated comicId ${comicId} successfully`);
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
 * @param {String} comicName - Name of the Comic to register
 * @param {Number} chapter - Chapter number of the last page read
 * @param {Number} page - Page number of the last page read
 * @param {BmcDataAPI~registerCb} cb
 *
 */
BmcDataAPI.prototype.registerComic = function(label, readerName, comicName,
                                              chapter, page, cb) {
    return this._scheme.nextId((err, id) => {
        if (err) {
            console.log(`Got error from scheme.nextId(): ${JSON.stringify(err)}`);
            return cb(err);
        }
        return this._scheme.getMap((err, map) => {
            const comic = new BmcComic(label, id, chapter, page);

            const comicKey = this._scheme.keyFromId(id);
            const dataset = {};
            dataset[comicKey] = BmcComic.serialize();

            const source = new BmcComicSource(readerName, comicName);
            const sourceKey = this._scheme.computeSourceKey(source);
            map[sourceKey] = id;
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
 * @param {String} comicName - Name of the Comic to register as the aliased source
 * @param {BmcDataAPI~aliasCb} cb
 */
BmcDataAPI.prototype.aliasComic = function(comicId, readerName, comicName, cb) {
    return this._scheme.getMap((err, map) => {
        const source = new BmcComicSource(readerName, comicName);
        const sourceKey = this._scheme.computeSourceKey(source);
        map[sourceKey] = comicId;
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
            if (map[key] === comicId) {
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
        // Build an inverse mapping; comicId -> sources list
        const map = data[this._scheme.BMC_MAP_KEY];
        const inverseMap = Object.keys(map).reduce((acc, key) => {
            const comicId = map[key];
            if (acc[comicId] === undefined) {
                acc[comicId] = [];
            }
            acc[comicId].push(BmcComicSource.deserialize(key));
        }, {});
        const keys = Object.keys(data).filter(
            key => key.indexOf(this._scheme.BMC_KEY_PREFIX) !== -1
        );
        // Directly use the inverse mapping to set all sources while creating
        // the BmcComic objects.
        const results = keys.map(key => {
            const comic = BmcComic.deserialize(data[key]);
            inverseMap[comic._id].forEach(source => comic.addSource(source));
            return comic;
        });
        return cb(null, results);
    });
}

