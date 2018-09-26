function generateBookmarkList(bookmarks) {
    console.log("generating bookmark list");
    var mangaList = document.getElementById("manga-list");
    for (var i = 0; i < bookmarks.length; ++i) {
        var manga = document.createElement('div');
        manga.innerText = bookmarks[i];
        manga.onclick = function() {
            clickedOnManga(this.innerText);
        };
        mangaList.appendChild(manga);
    }
}

function hideMangaEntry(entry) {
	entry.style.display = 'none';
}

function showMangaEntry(entry) {
	entry.style.display = '';
}

function fuzzyMatch(value, match) {
	var lvalue = value.toLowerCase();
	var lmatch = match.toLowerCase();
	for (var i=0; i < lmatch.length; ++i) {
		var idx = lvalue.indexOf(lmatch[i]);
		if (idx === -1) {
			return false;
		}
		lvalue = lvalue.slice(idx);
	}
	return true;
}

function filterBookmarkList() {
	var sbox = document.getElementById('searchbox');
	var str = sbox.value;
	var mangaList = document.getElementById('manga-list');
	for (var i=0; i < mangaList.childNodes.length; ++i) {
		entry = mangaList.childNodes[i];
		if (fuzzyMatch(entry.innerText, sbox.value)) {
			showMangaEntry(entry);
		} else {
			hideMangaEntry(entry);
		}
	};
}

function clickedOnManga(comicName) {
    const engine = new BmcEngine();
    engine.addEventListener(engine.events.register.error, err => {
    });
    engine.addEventListener(engine.events.register.complete, () => {
        console.log('clickedOnManga!');
        window.top.postMessage(`{"comicName": "${comicName.split('"').join('\\"')}"}`, '*');
    });
    engine.register(comicName, null, null);
}

function addEvents() {
    var but = document.getElementById('hide-but');
    but.onclick = function() {
        showHideSidePanel(but);
    };
     var sbox = document.getElementById('searchbox');
     sbox.oninput = function() {
     	  console.log('Input of searchbox changed: filtering bookmarks list');
     	  filterBookmarkList();
     };
}

function showHideSidePanel(elem) {
    var panel = document.getElementById("side-panel");
    if (panel.style.display === "none") {
        panel.style.display = '';
        elem.innerText = '<';
        elem.style.left = '';
        elem.style.right = '0';
    } else {
        panel.style.display = 'none';
        elem.innerText = '>';
        elem.style.left = '0';
        elem.style.right = 'initial';
    }
}

var fakeBookmarks = ["naruto", "bleach", "one piece", "goblin slayer", "hunter x hunter"];
generateBookmarkList(fakeBookmarks);
addEvents();
