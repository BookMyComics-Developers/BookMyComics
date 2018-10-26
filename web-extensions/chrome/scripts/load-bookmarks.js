const uriParams = document.location.search.split('?')[1].split('&');
const comicName = decodeURI(uriParams[0].split('=')[1]);
const chapter = uriParams[1].split('=')[1];
const page = uriParams[2].split('=')[1];
console.log(`BmcSideBar: comic ${comicName}, chapter=${chapter}, page=${page}`);

function BmcMangaList() {
    this._node = document.getElementById('manga-list');
}

BmcMangaList.prototype.onEntryClick = function(comicId) {
    console.log('clickedOnManga!');
    window.top.postMessage({comicId}, '*');
}

BmcMangaList.prototype.generateComic = function(comic) {
    const elm = document.createElement('ul');
    elm.classList.toggle('mangaListItem');

    const comicElem = document.createElement('li');
    elm.appendChild(comicElem);

    const comicDiv = document.createElement('div');
    comicElem.appendChild(comicDiv);

    const comicLabel = document.createElement('span');
    comicLabel.classList.toggle('rollingArrow');
    comicLabel.innerText = comic.label;
    comicLabel.onclick = () => {
        comicDiv.parentElement.querySelector('.nested').classList.toggle('active');
        comicLabel.classList.toggle('rollingArrow-down');
    }
    comicDiv.appendChild(comicLabel);

    const comicSrcList = document.createElement('ul');
    comicSrcList.classList.toggle('nested');
    comicElem.appendChild(comicSrcList);

    comic.iterSources(source => {
        const srcElem = document.createElement('div');
        srcElem.innerText = source.reader;
        comicSrcList.appendChild(srcElem);
    });

    return elm;
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
    bookmarks.forEach(bkmk => {
        comic = new BmcComic(bkmk.label, bkmk.id, 3, 21);
        comic.addSource(new BmcComicSource(bkmk.label, 'mangaeden'));
        comic.addSource(new BmcComicSource(bkmk.label, 'mangafox'));
        comic.addSource(new BmcComicSource(bkmk.label, 'mangahere'));
        comic.addSource(new BmcComicSource(bkmk.label, 'mangareader'));
        console.warn('fake comic generated for', bkmk.label);
        mangaList.appendChild(this.generateComic(comic))
        console.warn('fake comic added for', bkmk.label);
    });
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
    var evData = {
        type: "action",
        action: null,
    };
    var btn = document.getElementById('hide-but');
    var panel = document.getElementById("side-panel");
    if (panel.style.display === "none") {
        evData.action = "ShowSidePanel",
        panel.style.display = '';
        panel.style.width = 'calc(100vw - 16px)';
        btn.innerText = '<';
        btn.style.left = '';
        btn.style.right = '0';
    } else {
        evData.action = "HideSidePanel",
        panel.style.display = 'none';
        panel.style.width = '0';
        btn.innerText = '>';
        btn.style.left = '0';
        btn.style.right = 'initial';
    }
    // Notify top window of the SidePanel action
    window.top.postMessage(evData, '*');
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
