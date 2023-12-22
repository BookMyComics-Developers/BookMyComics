/* globals
    BmcComicSource:readable
    BmcComic:readable
    LOGS:readable
    cloneArray
*/

function MangaNatoComPlugin() {
}

MangaNatoComPlugin.prototype.getInfos = function(url, doc) {
    const comic = new BmcComic(null, null, null, null, null);
    let source = null;
    const parts = url.split('/').filter(s => s.length !== 0);

    if (parts.length < 1) {
        return null;
    } else if (parts[parts.length - 1].indexOf('chapter-') !== 0) {
        // manga page
        const elem = doc.querySelectorAll('.panel-story-info>.story-info-right>h1')[1];
        if (!elem) {
            LOGS.log('S77');
            return null;
        }
        const name = elem.innerText;
        const id = parts[parts.length - 1].split('-')[1];
        source = new BmcComicSource(id, 'manganato.com', {homeUrl: url});
        comic.label = name;
    } else {
        // chapter page
        const elems = cloneArray(doc.querySelectorAll('.panel-breadcrumb > a.a-h'));
        if (elems.length < 3) {
            LOGS.log('S79');
            return null;
        }
        const name = elems[1].innerText;
        const homeUrl = elems[1].getAttribute('href').split('manganato.com')[1];
        const chapter = parts[parts.length - 1].split('-')[1].split('.');
        const id = parts[parts.length - 2].split('-')[1];
        source = new BmcComicSource(name, 'chapmanganato.to', {id: id, homeUrl: homeUrl});
        comic.chapter = chapter;
        comic.page = null;
    }

    comic.addSource(source);
    return comic;
};

MangaNatoComPlugin.prototype.computeURL = function(comic, source) {
    // At the time of development, MangaNato SSL certificate seems legit and
    // working out of the box, so we might as well enforce HTTPS as a default.
    // Might be configurable later on.
    if (comic.chapter) {
        let chapter_ref = comic.chapter;
        if (Array.isArray(comic.chapter)) {
            chapter_ref = comic.chapter.join('.');
        }
        return `https://chapmanganato.to/manga-${source.info.id}/chapter-${chapter_ref}`;
    }
    return `https://chapmanganato.to${source.info.homeUrl}`;
};
