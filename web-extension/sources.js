/* globals
    FanFoxNetPlugin:readable
    MangaNatoComPlugin:readable
    MangaKakalotComPlugin:readable
    IsekaiScanComPlugin:readable
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
        {
            key: 'readmanganato.com',
            makeObj: () => new MangaNatoComPlugin(),
        },
        {
            key: 'chapmanganato.to',
            makeObj: () => new MangaNatoComPlugin(),
        },
        {
            key: 'mangakakalot.com',
            makeObj: () => new MangaKakalotComPlugin(),
        },
        {
            key: 'isekaiscan.com',
            makeObj:() => new IsekaiScanComPlugin(),
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

BmcSources.prototype.getInfos = function(origin, url, doc) {
    var ori = this._fromOrigin(origin);
    return ori ? ori.getInfos(url, doc) : null;
};
