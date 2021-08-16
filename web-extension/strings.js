/* globals
    cloneArray
*/

const INFO = 0;
const DEBUG = 1;
const WARNING = 2;
const ERROR = 3;

const DEFAULT_LANG = 'en';

String.prototype.improvedFormatter = String.prototype.improvedFormatter ||
function () {
    'use strict';
    var str = this.toString();

    if (arguments.length) {
        var t = typeof arguments[0];
        var key;
        var args = ('string' === t || 'number' === t) ? cloneArray(arguments) : arguments[0];

        for (key in args) {
            str = str.replace(new RegExp('\\{' + key + '\\}', 'gi'), args[key]);
        }
    }

    return str;
};

function Localization(lang = DEFAULT_LANG) {
    this.lang = lang;

    this.STRINGS = {
        // 'S1': {
        //     'en': 'Unknown string/error code',
        // },
        'S2': {
            'en': 'BmcEngine._memoizeComic: unknown comic name.',
        },
        'S3': {
            'en': 'BmcEngine: Resetting ID memoization after end of ongoing memoization',
        },
        'S4': {
            'en': 'BmcEngine: Resetting ID memoization',
        },
        'S5': {
            'en': 'Memoization reset complete',
        },
        'S6': {
            'en': 'BmcEngine.track: Nothing to track',
        },
        'S7': {
            'en': 'BookMyComic: bmcEngine.track: manga={manga} chapter={chapter} page={page}',
        },
        'S8': {
            'en': 'Attempting track: event={event}',
        },
        'S9': {
            'en': 'BookMyComic: bmcEngine.track.doTrack: Got comicId from storage: {id}',
        },
        'S10': {
            'en': 'BookMyComic: bmcEngine.register: label={label} reader={reader} manga={manga} chapter={chapter} page={page}',
        },
        'S11': {
            'en': 'Register completed with ERR={err}',
        },
        'S12': {
            'en': 'BookMyComic: bmcEngine.alias: id={comicId} reader={reader} manga={manga}',
        },
        'S13': {
            'en': 'Could not alias current page to comicId {id}: {err}',
        },
        'S14': {
            'en': 'Instanciated {elem}',
        },
        'S15': {
            'en': 'Could not register Comic {label}: {err}',
        },
        'S16': {
            'en': 'Scheme could not retrieve Comic map',
        },
        'S17': {
            'en': 'Cannot add already existing source: {data}',
        },
        'S18': {
            'en': 'Got FIND error: {data}',
        },
        'S19': {
            'en': 'Found data: {data}',
        },
        'S20': {
            'en': 'Could not find comicId: {data}',
        },
        'S21': {
            'en': 'Could not find comic data',
        },
        'S22': {
            'en': 'Cannot go backwards in comic',
        },
        'S23': {
            'en': 'Got Update error: {data}',
        },
        'S24': {
            'en': 'Updated comicId {comicId} successfully',
        },
        'S25': {
            'en': 'Got error from scheme.nextId(): {data}',
        },
        'S26': {
            'en': 'Got message error: {data}',
        },
        'S27': {
            'en': 'BmcMessagingHandler: EventData is of unexpected type',
        },
        'S28': {
            'en': 'Received RUNTIME message: {msg}',
        },
        'S29': {
            'en': 'BmcMessagingHandler: event is of unexpected type',
        },
        'S30': {
            'en': '[Wrapper] Selected mode: {mode}',
        },
        'S31': {
            'en': 'Inserting iframe src={src}',
        },
        'S32': {
            'en': 'Hiding Side-Panel: Re-setting up tracker',
        },
        'S33': {
            'en': 'Showing Side-Panel: Hiding tracker',
        },
        'S34': {
            'en': 'BmcUi: Sending message to SidePanel for notification display',
        },
        'S35': {
            'en': 'Cannot find an frame with unknown Definition. Please raise the '
              + 'issue to the developers, as it is due to a development '
              + 'mistake.',
        },
        'S36': {
            'en': 'FrameFinder.find: Searching frame with id approach',
        },
        'S37': {
            'en': 'FrameFinder.find: Found frame with inspect approach',
        },
        'S38': {
            'en': 'Could not identify requested frame, please contact the webext'
                          + ' developers.<br/>{data}',
        },
        'S39': {
            'en': 'BookMyComics: entrypoint.js: Requesting URL parsing from background script',
        },
        // 'S40': {
        //     'en': 'BookMyComics: entrypoint.js: sendmessage failed: err={err}',
        // },
        'S41': {
            'en': 'BookMyComics: entrypoint.js: retrieved ComicInfo={data}',
        },
        'S42': {
            'en': 'Instanciated BmcEngine',
        },
        'S43': {
            'en': 'Attempting to reload for iframe: {iframe}',
        },
        'S44': {
            'en': 'BmcSideBar: origin {origin}',
        },
        'S45': {
            'en': 'Loading required Bmc utilities',
        },
        'S46': {
            'en': 'BmcSideBar: BmcMangaList: onAlias: Label={label} id={id}',
        },
        // 'S47': {
        //     'en': 'BookMyComics: load-bookmark.js: sendmessage failed: err={err}',
        // },
        // 'S48': {
        //     'en': 'clickedOnManga!, mode={mode}, event: {event}',
        // },
        'S49': {
            'en': 'generating bookmark list',
        },
        // 'S50': {
        //     'en': 'BmcSidePanel: BmcMangaList: Unknown MODE "{mode}"',
        // },
        'S51': {
            'en': 'Input of searchbox changed: filtering bookmarks list',
        },
        // 'S52': {
        //     'en': 'BookMyComics does not support empty labels to identify a comic.<br>'
        //            + 'Please define a label in the Side Panel\'s text area first.',
        // },
        'S53': {
            'en': 'BmcSidePanel: received message to display status notification op={op} err={error}',
        },
        'S54': {
            'en': 'BmcSidePanel: Handling request to show Register button',
        },
        'S55': {
            'en': 'Removing transition',
        },
        'S56': {
            'en': 'BmcSidePanel: {operation} failed: {error}',
        },
        'S57': {
            'en': 'Attempting to delete source {reader}:{name} '
                  + 'from comic {comic} ({id})',
        },
        'S58': {
            'en': 'Attempting to delete comic {comic} ({id})',
        },
        'S59': {
            'en': 'Could not delete current {kind}: {reason}',
        },
        'S60': {
            'en': 'BookMyComics: bmcEngine.delete: id={id} reader={reader} manga={name}',
        },
        'S61': {
            'en': 'Source to remove ({reader}:{name})'
                  + ' has already been removed from comic {id} aliases',
        },
        'S62': {
            'en': 'Invalid chapter/page information received: {chapter}/{page}',
        },
        'S63': {
            'en': 'No current comic information available',
        },
        'S64': {
            'en': 'No entry selected, we shouldn\'t be here...',
        },
        'S66': {
            'en': 'BookMyComics: bookmycomics.js: Instanciated BmcSources',
        },
        // 'S67': {
        //     'en': 'BookMyComics: background-script.js: Instanciated BmcMessagingHandler',
        // },
        'S68': {
            'en': 'BookMyComics: bookmycomics.js: Handling URL:Generate Request: {evData}',
        },
        // 'S69': {
        //     'en': 'BookMyComics: bookmycomics.js: Handling URL:Parse Request: {evData}',
        // },
        'S70': {
            'en': 'Missing operation in BmcUI.makeNotification',
        },
        'S71': {
            'en': 'Got error from scheme.getLabelMap(): {data}',
        },
        'S72': {
            'en': 'Label provided is not unique (it already exists)',
        },
        'S73': {
            'en': 'Could not find MangaList Item to refresh in the DOM (it was supposed to exist).',
        },
        'S74': {
            'en': 'Could not find Comic from the storage, while it was recently registered/aliased.',
        },
        'S75': {
            'en': 'Comic information couldn\'t be retrieved',
        },
        'S76': {
            'en': 'Failed to initialize the extension: {error}',
        },
        'S77': {
            'en': 'Cannot get manga title',
        },
        'S78': {
            'en': 'Cannot get manga ID from chapters list',
        },
        'S79': {
            'en': 'Cannot get manga home page nor its name',
        },
    };
}

Localization.prototype.getString = function(s, add) {
    if (!Object.prototype.hasOwnProperty.call(this.STRINGS, s)) {
        return 'Unknown string: ' + s;
    }
    let lang = this.lang;
    if (!Object.prototype.hasOwnProperty.call(this.STRINGS[s], lang)) {
        lang = 'en';
    }
    if (add) {
        return this.STRINGS[s][lang].improvedFormatter(add);
    }
    return this.STRINGS[s][lang];
};

function Logs(level = INFO) {
    this.level = level;

    this.ERRORS = {
        // 'E0000': 'S1',
        'E0001': 'S2',
        // 'E0002': 'S40',
        'E0003': 'S43',
        'E0004': 'S29',
        // 'E0005': 'S6',
        // 'E0006': 'S7',
        'E0007': 'S8',
        'E0008': 'S27',
        'E0009': 'S17',
        'E0010': 'S15',
        'E0011': 'S13',
        'E0012': 'S38',
        // 'E0013': 'S47',
        // 'E0014': 'S50',
        'E0015': 'S55',
        'E0016': 'S56',
        'E0017': 'S59',
        'E0018': 'S61',
        'E0019': 'S62',
        'E0020': 'S63',
        'E0022': 'S75',
        'E0023': 'S76',
    };
}

Logs.prototype.display = function(e, printer, add) {
    printer(this.getString(e, add));
};

Logs.prototype.log = function(e, add) {
    // eslint-disable-next-line no-console
    this.display(e, console.log, add);
};

Logs.prototype.debug = function(e, add) {
    if (this.level >= DEBUG) {
        // eslint-disable-next-line no-console
        this.display(e, console.debug, add);
    }
};

Logs.prototype.warn = function(e, add) {
    if (this.level >= WARNING) {
        // eslint-disable-next-line no-console
        this.display(e, console.warn, add);
    }
};

Logs.prototype.error = function(e, add) {
    if (this.level >= ERROR) {
        // eslint-disable-next-line no-console
        this.display(e, console.error, add);
    }
};

Logs.prototype.getString = function(e, add) {
    if (e.startsWith('E')) {
        if (Object.prototype.hasOwnProperty.call(this.ERRORS, e)) {
            return `[${e}] ${LOCALIZATION.getString(this.ERRORS[e], add)}`;
        }
    } else if (Object.prototype.hasOwnProperty.call(LOCALIZATION.STRINGS, e)) {
        return LOCALIZATION.getString(e, add);
    }
    return this.getString('E0000', e);
};

/* eslint-disable no-unused-vars */
/* Globals imported through the including of files driven by manifest.json */
const LOGS = new Logs();
const LOCALIZATION = new Localization();
/* eslint-enable no-unused-vars */
