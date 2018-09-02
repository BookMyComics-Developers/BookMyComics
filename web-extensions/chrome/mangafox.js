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
    console.log("current manga: " + manga);
    if (chapter !== null) {
        console.log("current chapter: " + chapter);
        if (page !== null) {
            console.log("current page: " + page);
        }
    }
}

sendUpdatesForMangaFox();
