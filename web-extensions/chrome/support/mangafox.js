function sendUpdatesForMangaFox() {
    var path = window.location.pathname;
    var parts = path.split("/").filter(function(s) { return s.length !== 0});

    if (parts.length < 2) {
        return;
    }
    var manga = parts[1];
    var chapter = null;
    var page = null;
    if (parts.length > 3) {
        chapter = parseInt(parts[2].replace('c', ''), 10);
        page = parts[3].replace('.html', '');
    }

    // Now, let the engine do its magic: Register, track, etc.
    const engine = new BmcEngine(manga, chapter, page);
    console.log('Instanciated BmcEngine');
    engine.setup();
}

sendUpdatesForMangaFox();
