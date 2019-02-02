function MangaEdenComPlugin() {
}

MangaEdenComPlugin.prototype.parseURL = function(url) {
    var parts = url.split("/").filter(function(s) { return s.length !== 0});

    if (parts.length < 3) {
        return null;
    }
    var manga = parts[2];
    var chapter = null;
    var page = null;
    if (parts.length > 4) {
        chapter = parts[3];
        page = parts[4];
    }

    return { manga, chapter, page };
}
