function sendUpdatesForMangaEden() {
    var path = window.location.pathname;
    var parts = path.split("/").filter(function(s) { return s.length !== 0});

    if (parts.length < 3) {
        return;
    }
    var manga = parts[2];
    var chapter = null;
    var page = null;
    if (parts.length > 4) {
        chapter = parts[3];
        page = parts[4];
    }

    // Now, let the engine do its magic: Register, track, etc.
    const engine = new BmcEngine(window.location.hostname, manga, chapter, page);
    console.log('Instanciated BmcEngine');
    engine.setup();
}

sendUpdatesForMangaEden();
