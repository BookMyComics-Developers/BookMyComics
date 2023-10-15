/* globals
    BmcComic:readable
    BmcComicSource:readable
    BmcStorageFactory:readable
    BmcDataAPI: readable
    BmcBackgroundMessagingHandler:readable
    BmcSources:readable
    LOGS:readable
    cloneArray:readable
    stringToHTML:readable
    BmcSettings:readable
*/

/*
 * /!\  IMPORTANT - PLEASE READ  /!\
 *
 * There are many reasons in this web-extension for the existence of the
 * "background" or "extension" page (which uses this script as an entry-point).
 *
 * First of all, many contraints are pushed onto the web-extension development
 * by various security features of the browsers:
 *  - CORS (Cross Origin Resource Sharing) prevents any piece of code from
 *  calling specific APIs or loading URLs that are not authorized beforehands
 *  by the website's developer. This makes the job of a web-extension more
 *  complex, as many thing are now authorized depending on the context.
 *  - Permission specification (manifest) & limitations based on the context of
 *  the script
 *
 * This has many implications including:
 * - Sidebar (frame loading the extension's URL) has no right to inspect the
 *   parent frame's DOM
 * - Sidebar (frame loading the extension's URL) cannot interact with browser
 *   storage
 *
 * Also, in a concern to keep the manifest duplication as small as possible for
 * each of the readers supported, we've chosen to:
 * - Avoid loading all reader support scripts into all pages
 *
 * All these constraints (most of which are enforced by the browser) led us to
 * increasingly consider the extension page as a central HUB for messaging, and
 * interacting with the storage implementation, explaining why:
 *  - All reader support scripts are loaded into the extension page
 *  - The extension script is mostly about handling messages and computing
 *    stuff on behalf of other scripts.
 *  - A lot of apparently simple logics have become a multi-step process of
 *    message exchanges and computations
 */

const BACKGROUND_ID = 'BookMyComics/BackgroundScript';

const bmcSources = new BmcSources();
LOGS.log('S66');

let bmcStorageEngine = null;
let bmcData = null;

// NOTE: Optimistically, we "hope" the settings and storage engine will be
// ready by the time another page attempts to make use of them.
const bmcSettings = new BmcSettings();
bmcSettings.refresh((err) => {
    if (err) {
        // TODO
        alert(LOGS.getString('', {err: err}));
        return ;
    }
    bmcStorageEngine = BmcStorageFactory.new(null /* Let factory choose*/, bmcSettings);
    if (bmcStorageEngine === null)
        alert('BookMyComics could not find a working Storage Engine. Please check the settings.');
    bmcData = new BmcDataAPI(bmcStorageEngine);
});

const bmcMessaging = new BmcBackgroundMessagingHandler();
LOGS.log('S67');

bmcMessaging.addHandler(
    BACKGROUND_ID,
    ev => ev.data.type === 'computation'
       && ev.data.module === 'sources'
       && ev.data.computation === 'URL:Generate:Request',
    ev => {
        LOGS.log('S68', {'evData': JSON.stringify(ev.data)});
        bmcData.getComic(ev.data.resource.id, (err, comic) => {
            let answerEv = {
                type: 'computation',
                module: 'sources',
                computation: 'URL:Generate:Response',
                resource: {
                    err: false,
                    url: null,
                },
            };
            if (err) {
                answerEv.err = LOGS.getString('S1');
                return bmcMessaging.send(ev.channel.sender.tab.id, answerEv);
            }
            answerEv.resource.url = bmcSources.computeURL(ev.data.resource.reader, comic);
            if (!answerEv.resource.url) {
                answerEv.err = LOGS.getString('S40', {'comic': comic});
                return bmcMessaging.send(ev.channel.sender.tab.id, answerEv);
            }
            return bmcMessaging.send(ev.channel.sender.tab.id, answerEv);
        });
    }
);

function sendNotificationWithComicInfo(operation, comic, source, err) {
    var evData = {
        type: 'action',
        action: 'notification',
        operation: operation,
        error: (err||{}).message,
        comic: comic.serialize(),
        source: source ? source.toDict() : null,
    };
    bmcMessaging.broadcast(evData);
}

function notifyImport(channel, err) {
    let answerEv = {
        type: 'action',
        action: 'notification',
        operation: 'import',
        error: !!err,
    };
    if (channel)
        bmcMessaging.send(channel, answerEv);
    else
        bmcMessaging.broadcast(answerEv);
}

// Handle "Export"
bmcMessaging.addHandler(
    BACKGROUND_ID,
    ev => ev.data.type === 'action' && ev.data.action === 'export',
    ev => {
        return bmcData.export((err, data) => {
            // TODO
            LOGS.debug('', {'err': err});
            let answerEv = {
                type: 'action',
                action: 'notification',
                operation: 'export',
                payload: data,
                error: !!err,
            };
            return bmcMessaging.send(ev.channel.sender.tab.id, answerEv);
        });
    }
);
// Handle "Import"
bmcMessaging.addHandler(
    BACKGROUND_ID,
    ev => ev.data.type === 'action' && ev.data.action === 'import',
    ev => {
        return bmcData.import(ev.data.payload, (err) => {
            // TODO
            LOGS.debug('', {'err': err});
            // Notify everyone that an import happened.
            // In case of success, it is expected that all sidebars should clear and reload their contents.
            notifyImport(err);
        });
    }
);
// Handle Storage configuration & data migration
bmcMessaging.addHandler(
    BACKGROUND_ID,
    ev => ev.data.type === 'action'
        && ev.data.module === 'storage'
        && ev.data.action === 'configure',
    ev => {
        const oldApi = bmcData;
        if (ev.data.source !== BmcStorageFactory.default(bmcSettings)) {
            // TODO Specify ERROR ? LOG ?
            const answerEv = {
                type: 'action',
                action: 'notification',
                operation: 'configure',
                module: 'storage',
                error: true,
            };
            bmcMessaging.send(ev.channel.sender.tab.id, answerEv);
            return ;
        }
        bmcStorageEngine = BmcStorageFactory.new(ev.data.target, bmcSettings);
        if (!bmcStorageEngine) {
            // TODO Specify ERROR ? LOG ?
            const answerEv = {
                type: 'action',
                action: 'notification',
                operation: 'configure',
                module: 'storage',
                error: true,
            };
            bmcMessaging.send(ev.channel.sender.tab.id, answerEv);
            return ;
        }
        bmcData = new BmcDataAPI(bmcStorageEngine);
        oldApi.export((export_err, data) => {
            if (export_err) {
                LOGS.debug('E0004', {'err': export_err});
                notifyImport(ev.channel.sender.tab.id, export_err);
                return ;
            }
            bmcData.import(data, (import_err) => {
                if (import_err) {
                    LOGS.debug('E0005', {'err': import_err});
                    notifyImport(import_err);
                    return ;
                }
                // Only save the setting once we've transfered all the data successfully
                bmcSettings.set('storage-engine', ev.data.target, (err) => {
                    if (err) {
                        // TODO
                        // alert(LOGS.getString('', {err: err}));
                        notifyImport(err);
                        return ;
                    }
                    // Broadcast info to all parties
                    notifyImport(null);
                    // Notify migration success
                    const answerEv = {
                        type: 'action',
                        action: 'notification',
                        operation: 'configure',
                        module: 'storage',
                        error: false,
                    };
                    bmcMessaging.send(ev.channel.sender.tab.id, answerEv);
                    // Fire-and-forget -> Everything is good, we can delete old data.
                    oldApi.clear(() => {});
                });
            });
        });
    }
);

// Handle "Register"
bmcMessaging.addHandler(
    BACKGROUND_ID,
    ev => ev.data.type === 'action' && ev.data.action === 'register',
    ev => {
        const comic = BmcComic.deserialize(ev.data.comic);
        comic.label = ev.data.label;
        const source = BmcComicSource.fromDict(ev.data.source);
        register(
            ev.data.label,
            comic,
            source,
            (err, id) => {
                let retErr = null;
                if (err) {
                    retErr = new Error(
                        LOGS.getString('E0010', {
                            'label': ev.data.label,
                            'err': err.message,
                        })
                    );
                }
                ev.data.comic.id = id;
                sendNotificationWithComicInfo('Register Comic', comic, source, retErr);
            });
    }
);
// Handle "Alias"
bmcMessaging.addHandler(
    BACKGROUND_ID,
    ev => ev.data.type === 'action' && ev.data.action === 'alias',
    ev => {
        const comic = BmcComic.deserialize(ev.data.comic);
        const source = BmcComicSource.fromDict(ev.data.source);
        alias(
            comic,
            source,
            err => {
                let retErr = null;
                if (err) {
                    retErr = new Error(LOGS.getString('E0011', {
                        'id': ev.data.comic.id,
                        'err': err.message
                    }));
                }
                sendNotificationWithComicInfo('Alias Comic', comic, source, retErr);
            });
    }
);
// Handle "Delete"
bmcMessaging.addHandler(
    BACKGROUND_ID,
    ev => ev.data.type === 'action' && ev.data.action === 'delete',
    ev => {
        const comic = BmcComic.deserialize(ev.data.comic);
        const source = ev.data.source ? BmcComicSource.fromDict(ev.data.source) : null;
        deleteSourceOrComic(
            comic,
            source,
            err => {
                let retErr = null;
                if (err) {
                    retErr = new Error(LOGS.getString('E0017', {
                        kind: ev.data.source ? 'Source' : 'Comic',
                        reason: err.message,
                    }));
                }
                const kind = ev.data.source ? 'Comic Source' : 'Comic';
                sendNotificationWithComicInfo(`Delete ${kind}`, comic, source, retErr);
            });
    }
);

// Handle "check-for-update" (Checking updates on one comic/source)
bmcMessaging.addHandler(
    BACKGROUND_ID,
    ev => ev.data.type === 'action' && ev.data.action === 'check-for-update',
    ev => {
        const evComic = BmcComic.deserialize(ev.data.comic);
        bmcData.getComic(evComic.id, (err, comic) => {
            if (err) {
                return ;
            }
            // Do nothing upon completion
            checkSourcesUpdates(comic, cloneArray(comic._sources), () => {});
        });
    }
);

// Handle "check-for-updates" (Checking updates on all comics/sources)
bmcMessaging.addHandler(
    BACKGROUND_ID,
    ev => ev.data.type === 'action' && ev.data.action === 'check-for-updates',
    () => {
        bmcData.list((err, list) => {
            if (err) {
                return ;
            }
            const evData = {
                type: 'action',
                action: 'notification',
                operation: 'Check Updates',
                step: 'started',
                error: false,
            };
            bmcMessaging.broadcast(evData);
            checkComicUpdates(list, err => {
                const evData = {
                    type: 'action',
                    action: 'notification',
                    operation: 'Check Updates',
                    step: 'completed',
                    error: !!err,
                };
                bmcMessaging.broadcast(evData);
            });
        });
    }
);


/*
 * This function registers a comic into the saved data. It shall be used by the
 * user-interacting UI spawned on an online reader's page.
 *
 * @param {String} label - the Comic's user-defined label
 * @param {BmcComic} comic - the Comic's object
 * @param {BmcComicSource} source - the Source object for the comic
 *
 * @return {undefined}
 */
function register(label, comic, source, cb) {
    LOGS.log('S10', {'common': {label: label, chapter: comic.chapter, page: comic.page},
                     'source': JSON.stringify(source)});
    return bmcData.registerComic(label, comic, source, (reg_err, id) => {
        LOGS.debug('S11', {'err': reg_err});
        bmcData.getComic(id, (get_err, comicData) => {
            // Skip up-to-date checks if `get` failed.
            if (get_err)
                return cb(reg_err, id);
            checkSourcesUpdates(comicData, cloneArray(comicData._sources), () => {
                return cb(reg_err, id);
            });
        });
    });
}

/*
 * This function registers a new name for an existing comic into the saved data.
 * Then, it also updates the progress of reading for this comic.
 *
 * @param {BmcComic} comic - the Comic's object
 * @param {BmcComicSource} source - the Source object for the comic
 *
 * @return {undefined}
 */
function alias(comic, source, cb) {
    LOGS.log('S12', {'comicId': comic.id,
                     'label': comic.label,
                     'source': JSON.stringify(source)});
    return bmcData.aliasComic(comic.id, source, err => {
        return cb(err);
    });
}

/*
 * This function deletes a Source from a comic or a whole Comic, given a comic
 * ID, and an optional reader and name.  If the deleted source was the last
 * source associated to the Comic, the Comic will be deleted along with its
 * last Source.
 *
 * @param {Number} comicId - Unique comic ID
 * @param {BmcComicSource} source - the Source object for the comic
 *
 * @return {undefined}
 */
function deleteSourceOrComic(comic, source, cb) {
    LOGS.debug('S60', { id: comic.id, source: JSON.stringify(source) });

    // Both reader and name must be defined to identify a source according to
    // engine/datamodel.js
    // As such, if either is undefined, assume we're targeting the whole comic
    if (!source) {
        return bmcData.unregisterComic(comic.id, cb);
    }
    // Otherwise, remove the source (and optionally the Comic if it was the
    // last source)
    return bmcData.unaliasComic(comic.id, source, cb);
}

/*
 * Utility function to notify all sidebars that an Update Check was completed
 * on a specific comic/source.
 *
 * @param {BmcComic} the comic being checked
 * @param {BmcComicSource} the comic's source being checked
 *
 * @return {undefined}
 */
function checkSourcesUpdateNotif(comic, source, err) {
    let evData = {
        type: 'action',
        action: 'notification',
        operation: 'Check Updates',
        step: 'source',
        comic: comic.serialize(),
        source: source.toDict(),
        error: err ? err.toString() : null,
    };
    bmcMessaging.broadcast(evData);
}

/*
 * Function that checks one comic/source couple for updates.It will call
 * `startF` before processing, and `endF` at the end of processing this couple.
 * `startF` is optional and can be set to null instead.
 * Once checked, the source will be updated in the datamodel.
 *
 * @param {BmcComic} the comic being checked
 * @param {Array[BmcComicSource]} the array of comic sources to be checked
 * @param {callback} the continuation routine to call after everything is handled
 *
 * @return {undefined}
 */
function checkSourceUpdate(comic, source, cb) {
    // compute URL for comic/source
    const url = bmcSources.computeURL(source.reader, comic);
    // Fetch page's HTML
    fetch(url)
        .then(function(response) {
            if (!response.ok) {
                // Send comic/source end event (failure),
                // but continue processing the rest of the comics/sources
                checkSourcesUpdateNotif(
                    comic, source, true,
                    `Failed to fetch, HTTP Status ${response.status}(${response.statusText})`);
                // Tell the continuation routine to continue processing,
                // As this error only concerns the current comic/source.
                return cb(null);
            }
            return response.text();
        })
        .then(function(html_text) {
            let doc = stringToHTML(html_text);
            // Check for next button
            source.info.has_updates = bmcSources.hasNextPage(source.reader, doc);
            // Store result in DB
            bmcData.updateComicSource(comic.id, source, err => {
                // This error might come from the storage and be irrecoverable.
                // => We need to interrupt the updates check
                if (err) {
                    checkSourcesUpdateNotif(
                        comic, source, err,
                        `Failed to update source: ${JSON.stringify(err)}`);
                    return cb(err);
                }
                checkSourcesUpdateNotif(comic, source, null);
                return cb(null);
            });
        })
        .catch(function(error) {
            // Send comic/source end event (failure),
            // but continue processing the rest of the comics/sources
            checkSourcesUpdateNotif(comic, source, error);
            // Tell the continuation routine to continue processing,
            // As this error only concerns the current comic/source.
            return cb(null);
        });
}

/*
 * Async-recursive function which will check a list of sources for a given
 * comic for updates.It will notify all sidebars about the start/end of a
 * source check, and record the updates availability into the storage via the
 * datamodel.
 *
 * @param {BmcComic} the comic being checked
 * @param {Array[BmcComicSource]} the array of comic sources to be checked
 *
 * @return {undefined}
 */
function checkSourcesUpdates(comic, sources, cb) {
    if (sources.length === 0) {
        return cb(null /* no error */);
    }
    const nextSources = sources.splice(1);

    checkSourceUpdate(
        comic, sources[0],
        err => {
            if (err) {
                return cb(err);
            }
            // Then Recursively repeat for all remaining sources
            return checkSourcesUpdates(comic, nextSources, cb);
        });
    return null;
}

/*
 * Async-recursive function which will check a list of comic for updates.
 * For each of them, il will run the check for updates on each of their
 * sources.
 *
 * @param {BmcComic} the comic being checked
 * @param {Array[BmcComicSource]} the array of comic sources to be checked
 * @param
 *
 * @return {undefined}
 */
function checkComicUpdates(comics, cb) {
    if (comics.length === 0) {
        return cb(null /* no error */);
    }
    const nextComics = comics.splice(1);
    return checkSourcesUpdates(comics[0], cloneArray(comics[0]._sources), err => {
        if (err) {
            return cb(err);
        }
        return checkComicUpdates(nextComics, cb);
    });
}
