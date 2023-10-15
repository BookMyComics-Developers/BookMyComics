/* globals
    FanFoxNetPlugin:readable
    MangaNatoComPlugin:readable
    MangaKakalotComPlugin:readable
    IsekaiScanComPlugin:readable
    BookMyComicsTestPlugin:readable
*/

/**
 * This class is a proxy object which handles all supported sources and
 * provides utility functions to use the right piece of code, according to the
 * origin provided as method parameter.
 * It is used by any piece of code which requires to be loosely coupled to the
 * supported sources code.
 *
 * @class
 */
function BmcSources() {
    this._readers = {};
}

BmcSources.prototype._load = function(origin) {
    const sourceDescs = [
        {
            key: 'fanfox.net',
            makeObj: () => new FanFoxNetPlugin(),
        },
        {
            key: 'manganato.com',
            makeObj: () => new MangaNatoComPlugin(),
        },
        {  // Keep for backwards compat: Allow loading `readmanganato` pages
            key: 'readmanganato.com',
            makeObj: () => new MangaNatoComPlugin(),
        },
        {
            key: 'chapmanganato.com',
            makeObj: () => new MangaNatoComPlugin(),
        },
        {
            key: 'mangakakalot.com',
            makeObj: () => new MangaKakalotComPlugin(),
        },
        {
            key: 'isekaiscan.com',
            makeObj:() => new IsekaiScanComPlugin(),
        },
        // The two following entries are here to support two different
        // situations for the "localhost" simulacrum website.
        // * The support module registers the reader `localhost`
        // * The origin provided by the browser includes the port
        // Sadly, we cannot include the port by default, because otherwise, the
        // source mapping mechanism fails somewhere in the URL generation path
        {
            key: 'localhost',
            makeObj: () => new BookMyComicsTestPlugin(),
        },
        {
            key: 'localhost:5000',
            makeObj: () => new BookMyComicsTestPlugin(),
        }
    ];
    sourceDescs.forEach(desc => {
        if (desc.key === origin) {
            try {
                this._readers[desc.key] = desc.makeObj();
            } catch(e) {
                // eslint-disable-next-line no-console
                console.error(`Could not load script for ${desc.key}: ${e.message}`);
            }
        }
    });
};

// `preventRecurse` argument is optional, its value is `false` by default.
BmcSources.prototype._fromOrigin = function(origin, preventRecurse) {
    if (typeof preventRecurse === 'undefined') {
        preventRecurse = false;
    }
    const readerKey = Object.keys(this._readers).find(key => origin.indexOf(key) !== -1);
    if (!Object.prototype.hasOwnProperty.call(this._readers, readerKey)) {
        this._load(origin);
        if (preventRecurse !== true) {
            return this._fromOrigin(origin, true);
        }
        // FIXME: david, fix it please!
        // eslint-disable-next-line no-console
        console.warn('Could not find reader instance.');
        return undefined;
    }
    return this._readers[readerKey];
};

BmcSources.prototype.computeURL = function(origin, comic) {
    var ori = this._fromOrigin(origin);
    return ori ? ori.computeURL(comic, comic.getSource(origin)) : null;
};

BmcSources.prototype.hasNextPage = function(origin, doc) {
    var ori = this._fromOrigin(origin);
    return ori ? ori.hasNextPage(doc) : false;
};

BmcSources.prototype.getInfos = function(origin, url, doc) {
    var ori = this._fromOrigin(origin);
    return ori ? ori.getInfos(url, doc) : null;
};
