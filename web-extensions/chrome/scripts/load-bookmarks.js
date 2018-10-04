function BmcMangaList() {
    this._node = document.getElementById('manga-list');
}

BmcMangaList.prototype.onEntryClick = function(comicId) {
    console.log('clickedOnManga!');
    window.top.postMessage({comicId}, '*');
}

BmcMangaList.prototype.generate = function() {
    var bookmarks = [
        {label: "naruto",           id: 0},
        {label: "bleach",           id: 1},
        {label: "one piece",        id: 2},
        {label: "goblin slayer",    id: 3},
        {label: "hunter x hunter",  id: 4},
    ];

    console.log("generating bookmark list");
    var mangaList = document.getElementById("manga-list");
    for (var i = 0; i < bookmarks.length; ++i) {
        var manga = document.createElement('div');
        manga.innerText = bookmarks[i].label;
        manga.onclick = () => this.onEntryClick(bookmarks[i].id);
        mangaList.appendChild(manga);
    }
}

BmcMangaList.prototype.hideEntry = function(entry) {
    entry.style.display = 'none';
}

BmcMangaList.prototype.showEntry = function(entry) {
    entry.style.display = '';
}

BmcMangaList.prototype.match = function(value, match) {
    var lvalue = value.toLowerCase();
    var lmatch = match.toLowerCase();
    for (var i = 0; i < lmatch.length; ++i) {
        var idx = lvalue.indexOf(lmatch[i]);
        if (idx === -1) {
            return false;
        }
        lvalue = lvalue.slice(idx);
    }
    return true;
}

BmcMangaList.prototype.filter = function(filterStr) {
    for (var i = 0; i < this._node.childNodes.length; ++i) {
        entry = this._node.childNodes[i];
        if (this.match(entry.innerText, filterStr)) {
            this.showEntry(entry);
        } else {
            this.hideEntry(entry);
        }
    };
}


function showHideSidePanel() {
    var btn = document.getElementById('hide-but');
    var panel = document.getElementById("side-panel");
    if (panel.style.display === "none") {
        panel.style.display = '';
        panel.style.width = 'calc(100vw - 16px)';
        btn.innerText = '<';
        btn.style.left = '';
        btn.style.right = '0';
    } else {
        panel.style.display = 'none';
        panel.style.width = '0';
        btn.innerText = '>';
        btn.style.left = '0';
        btn.style.right = 'initial';
    }
}

function addEvents(mangaList) {
    // Clicking on the  `>`/`<` button will show/hide the panel
    var but = document.getElementById('hide-but');
    but.onclick = function() {
        showHideSidePanel();
    };

    // Input in searchbox will filter the list of mangas
    var sbox = document.getElementById('searchbox');
    sbox.oninput = function() {
        console.log('Input of searchbox changed: filtering bookmarks list');
        var str = sbox.value;
        mangaList.filter(str);
    };
}

var mangaList = new BmcMangaList();
mangaList.generate();
addEvents(mangaList);

// Hide panel by default
showHideSidePanel();
