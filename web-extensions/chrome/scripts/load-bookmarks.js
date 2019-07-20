/* globals
    BmcDataAPI:readable
    BmcMessagingHandler:readable
    BmcUI:readable
    compat:readable
    LOGS:readable
    cloneArray
*/

const uriParams = document.location.search.split('?')[1].split('&');
const hostOrigin = decodeURIComponent(uriParams[0].split('=')[1]);
LOGS.log('S44', {'origin': hostOrigin});

LOGS.log('S45');
const bmcMessaging = new BmcMessagingHandler(hostOrigin);
const bmcDb = new BmcDataAPI();

function BmcMangaList() {
    this._node = document.getElementById('manga-list');
}

function emptyElem(elem) {
    // NOTE: This method seems to be the most efficient as shown by
    // https://jsperf.com/innerhtml-vs-removechild/15
    while (elem.firstChild) {
        elem.removeChild(elem.firstChild);
    }
}

function sendAliasRequest(comicId) {
    bmcDb.getComic(comicId, (err, comic) => {
        let label = '<unknown manga>';
        if (comic !== null) {
            label = comic.label;
        }
        LOGS.log('S46', {'id': comicId, 'label': label});
        const evData = {
            type: 'action',
            action: 'alias',
            id: comicId,
        };
        window.top.postMessage(evData, '*');
    });
}

BmcMangaList.prototype.onBrowseClick = function(ev) {
    const target = ev.target;
    const comicDiv = target.parentElement;
    const comicElem = comicDiv.parentElement;
    const nested = cloneArray(comicElem.getElementsByClassName('nested'));
    for (var i = 0; i < nested.length; ++i) {
        nested[i].classList.toggle('active');
    }
    target.classList.toggle('rollingArrow-down');
};

BmcMangaList.prototype.onSourceClick = function(comic, source) {
    const ev = {
        type: 'computation',
        module: 'sources',
        computation: 'URL:Generate:Request',
        resource: {
            origin: window.location.origin,
            reader: source.reader,
            comic: Object.assign({
                common: {
                    name: source.name,
                    chapter: comic.chapter,
                    page: comic.page,
                },
            }, source.info),
        },
    };
    compat.sendMessage(ev, (err, response) => {
        if (err) {
            LOGS.warn('E0013', {'err': err});
            return undefined;
        }
        let localEv = {
            type: 'action',
            action: 'urlopen',
            url: response.resource.url,
        };
        // Let the content script at the page's root handle the URL opening
        window.top.postMessage(localEv, '*');
    });
};

BmcMangaList.prototype.onSourceDelete = function(ev) {
    const icon = ev.target;
    const srcElem = icon.parentElement;
    const srcLink = srcElem.firstChild;
    const srcList = srcElem.parentElement;
    const comicElem = srcList.parentElement;
    const comicDiv = comicElem.firstChild;
    const comicLabel = comicDiv.firstChild;

    this.sourceDelete(comicLabel.bmcData.id, srcLink.bmcData.reader, srcLink.bmcData.name,
                      comicLabel.innerText);
};

BmcMangaList.prototype.sourceDelete = function(comicId, reader, name, comicLabel) {
    LOGS.debug('S57', {
        reader: reader,
        name: name,
        comic: comicLabel || 'current page',
        id: comicId,
    });
    const evData = {
        type: 'action',
        action: 'delete',
        comic: {
            id: comicId,
        },
        source: {
            reader: reader,
            name: name,
        },
    };
    window.top.postMessage(evData, '*');
};

BmcMangaList.prototype.onEntryClick = function(ev) {
    this.onBrowseClick(ev);
};

BmcMangaList.prototype.onEntryDelete = function(ev) {
    const icon = ev.target;
    const comicDiv = icon.parentElement;
    const comicLabel = comicDiv.firstChild;

    LOGS.debug('S58', { comic: comicLabel.innerText, id: comicLabel.bmcData.id });

    const evData = {
        type: 'action',
        action: 'delete',
        comic: {
            id: comicLabel.bmcData.id,
        },
    };
    window.top.postMessage(evData, '*');
};

BmcMangaList.prototype.generateSource = function(comic, source, sourceListElem) {
    const srcElem = document.createElement('div');
    srcElem.classList.add('label-container');

    const srcLink = document.createElement('div');
    srcLink.classList.add('label');
    srcLink.innerText = source.reader;
    srcLink.bmcData = {
        reader: source.reader,
        name: source.name,
    };
    srcLink.onclick = this.onSourceClick.bind(this, comic, source);
    srcElem.appendChild(srcLink);

    const deleteSrcIcon = document.createElement('span');
    deleteSrcIcon.classList.add('fa', 'fa-trash');
    deleteSrcIcon.setAttribute('aria-hidden', 'true');
    deleteSrcIcon.onclick = this.onSourceDelete.bind(this);
    srcElem.appendChild(deleteSrcIcon);

    sourceListElem.appendChild(srcElem);
};

BmcMangaList.prototype.generateComic = function(comic) {
    const elm = document.createElement('div');
    elm.classList.toggle('mangaListItem');

    // Define the content on comic Label's line
    const comicDiv = document.createElement('div');
    comicDiv.classList.add('label-container');
    comicDiv.onclick = this.onEntryClick.bind(this);
    elm.appendChild(comicDiv);

    const comicLabel = document.createElement('div');
    comicLabel.classList.add('label', 'rollingArrow');
    comicLabel.innerText = comic.label;
    comicLabel.bmcData = {
        id: comic.id,
    };
    comicDiv.appendChild(comicLabel);

    const deleteIcon = document.createElement('span');
    deleteIcon.classList.add('fa', 'fa-trash');
    deleteIcon.setAttribute('aria-hidden', 'true');
    deleteIcon.onclick = this.onEntryDelete.bind(this);
    comicDiv.appendChild(deleteIcon);

    // Define the list of sources beneath the comic's Label
    const comicSrcList = document.createElement('div');
    comicSrcList.classList.toggle('nested');
    elm.appendChild(comicSrcList);

    comic.iterSources(source => {
        this.generateSource(comic, source, comicSrcList);
    });

    return elm;
};

BmcMangaList.prototype.generate = function() {
    LOGS.log('S49');
    var mangaList = document.getElementById('manga-list');

    // First, remove any child node, to ensure it's clean before we start
    // generating.
    emptyElem(mangaList);

    // Now that the parent is a clean slate, let's generate
    bmcDb.list((err, comics) => {
        comics.forEach(
            comic => mangaList.appendChild(this.generateComic(comic))
        );
    });
};

BmcMangaList.prototype.hideEntry = function(entry) {
    entry.style.display = 'none';
};

BmcMangaList.prototype.showEntry = function(entry) {
    entry.style.display = '';
};

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
};

BmcMangaList.prototype.filter = function(filterStr) {
    for (var i = 0; i < this._node.childNodes.length; ++i) {
        const entry = this._node.childNodes[i];
        // Need to dig through layers to reach the label's text
        const entryLabel = entry    // ul
            .childNodes[0]          // li
            .childNodes[0]          // div
            .childNodes[0];         // span == label
        if (this.match(entryLabel.innerText, filterStr)) {
            this.showEntry(entry);
        } else {
            this.hideEntry(entry);
        }
    }
};

function showDeleteButton() {
    displayButton(document.getElementById('delete-but'));
    document.getElementById('register-but').style.display = '';
    document.getElementById('side-adder').disabled = true;
}

function showRegisterButton() {
    displayButton(document.getElementById('register-but'));
    document.getElementById('delete-but').style.display = '';
    document.getElementById('side-adder').disabled = false;
}

function displayButton(btn) {
    const panel = document.getElementById('side-panel');
    if (panel && btn && panel.style.display !== 'block') {
        btn.style.display = 'block';
    }
}

function inputChanges() {
    var entries = Array.prototype.slice.call(document.getElementById('existing-entries')
        .childNodes);
    for (let i = 0; i < entries.length; ++i) {
        if (entries[i].innerText.indexOf(this.value) !== -1) {
            entries[i].style.display = '';
        } else {
            entries[i].style.display = 'none';
        }
    }
}

function addEvents(mangaList) {
    // Clicking on the  `>`/`<` button will show/hide the panel
    var but = document.getElementById('hide-but');
    but.onclick = showHideSidePanel;

    // Input in searchbox will filter the list of mangas
    var sbox = document.getElementById('searchbox');
    sbox.oninput = function() {
        LOGS.log('S51');
        var str = sbox.value;
        mangaList.filter(str);
    };

    const regBtn = document.getElementById('register-but');
    if (regBtn) {
        regBtn.onclick = showHideSidePanelAdder;
    }
    const delBtn = document.getElementById('delete-but');
    if (delBtn) {
        delBtn.onclick = showHideSidePanelDeleter;
    }

    // On button-add click, Trigger a new comic registration
    var addBut = document.getElementById('side-adder');
    if (addBut) {
        addBut.onclick = showHideSidePanelAdder;
    }
    var addIntoExistingBut = document.getElementById('add-into-existing');
    if (addIntoExistingBut) {
        addIntoExistingBut.onclick = showHideAddIntoExisting;
    }
    var cancelBut = document.getElementById('add-cancel');
    if (cancelBut) {
        cancelBut.onclick = showHideSidePanelAdder;
    }
    var confirmBut = document.getElementById('add-confirm');
    if (confirmBut) {
        confirmBut.onclick = function() {
            const label = document.getElementById('bookmark-name').value.trim();
            if (label.length < 1) {
                return;
            }
            showHideSidePanelAdder();
            // Now do the actual registration.
            const evData = {
                type: 'action',
                action: 'register',
                label,
            };
            window.top.postMessage(evData, '*');
        };
    }
    var confirmExistingBut = document.getElementById('add-existing-confirm');
    if (confirmExistingBut) {
        confirmExistingBut.onclick = function() {
            const selected = cloneArray(
                document.getElementById('existing-entries')
                    .getElementsByClassName('selected'));
            if (selected.length === 0) {
                LOGS.log('S64');
                return;
            }
            // We send the message to add into the DB.
            sendAliasRequest(selected[0].bmcData.id);
            // We hide the current panel.
            showHideAddIntoExisting();
            // We also hide the "adder" panel.
            showHideSidePanelAdder();
        };
    }
    var cancelExistingBut = document.getElementById('add-existing-cancel');
    if (cancelExistingBut) {
        cancelExistingBut.onclick = function() {
            // Hide current panel to go back to the "adder" one.
            showHideAddIntoExisting();
        };
    }
    var filterExistingEntries = document.getElementById('filter-existing');
    if (filterExistingEntries) {
        let inputChanges = function() {
            var entries = cloneArray(document.getElementById('existing-entries').childNodes);
            for (let i = 0; i < entries.length; ++i) {
                if (entries[i].innerText.indexOf(this.value) !== -1) {
                    entries[i].style.display = '';
                } else {
                    entries[i].style.display = 'none';
                }
            }
        };
        filterExistingEntries.onkeyup = inputChanges;
        filterExistingEntries.onchange = inputChanges;
        filterExistingEntries.oninput = inputChanges;
        filterExistingEntries.onpaste = inputChanges;
    }
    var bookmarkName = document.getElementById('bookmark-name');
    if (bookmarkName) {
        bookmarkName.oninput = function() {
            confirmBut.disabled = this.value.trim().length === 0;
        };
    }

    bmcMessaging.addWindowHandler(
        BmcUI.prototype.SIDEPANEL_ID,
        evData => evData.type === 'action' && evData.action === 'notification',
        evData => {
            LOGS.log('S53', {'op': evData.operation, 'error': evData.error});
            notifyResult(evData.operation, evData.error);
        });
    bmcMessaging.addWindowHandler(
        BmcUI.prototype.SIDEPANEL_ID,
        evData => evData.type === 'action' && evData.action === 'setup' && evData.operation === 'register',
        () => {
            mangaList.isRegistered = false;
            showRegisterButton();
            LOGS.log('S54');
        });
    bmcMessaging.addWindowHandler(
        BmcUI.prototype.SIDEPANEL_ID,
        evData => evData.type === 'action' && evData.action === 'notification' && evData.operation === 'track',
        evData => {
            if (evData.error) {
                // eslint-disable-next-line no-console
                console.error(evData.error);
            } else if (evData.comicId === undefined || evData.comicSource === undefined ||
                       evData.comicName === undefined) {
                LOGS.error('E0021', {'evData': evData});
            } else {
                mangaList.isRegistered = true;
                mangaList.currentComic = {
                    'id': evData.comicId,
                    'source': evData.comicSource,
                    'name': evData.comicName,
                };
                showDeleteButton();
            }
        });
    bmcMessaging.addWindowHandler(
        BmcUI.prototype.SIDEPANEL_ID,
        evData => evData.type === 'action' && evData.action === 'toggle' && evData.module === 'sidebar',
        () => {
            showHideSidePanel();
        });
    bmcMessaging.addWindowHandler(
        BmcUI.prototype.SIDEPANEL_ID,
        evData => evData.type === 'action' && evData.action === 'refresh' && evData.module === 'sidebar',
        () => {
            mangaList.generate();
        });
    bmcMessaging.addWindowHandler(
        BmcUI.prototype.SIDEPANEL_ID,
        evData => evData.type === 'action' && evData.action === 'notification' &&
                  (evData.operation === 'Alias Comic' || evData.operation === 'Register Comic' ||
                   evData.operation === 'Delete Comic Source' || evData.operation === 'Delete Comic'),
        evData => {
            if (evData.operation.startsWith('Delete')) {
                mangaList.isRegistered = false;
                mangaList.currentComic = undefined;
                regBtn.style.display = delBtn.style.display;
                delBtn.style.display = '';
            } else {
                mangaList.isRegistered = true;
                delBtn.style.display = regBtn.style.display;
                regBtn.style.display = '';
                mangaList.currentComic = {
                    'id': evData.comicId,
                    'source': evData.comicSource,
                    'name': evData.comicName,
                };
                if (evData.operation === 'Alias Comic') {
                    const mangas = Array.prototype.slice.call(document.getElementsByClassName('mangaListItem'));
                    let sourcesRef;
                    for (let i = 0; i < mangas.length; ++i) {
                        // div.mangaListItem > div.label-container > div.label
                        const manga = mangas[i].firstChild.firstChild;
                        if (manga.bmcData.id !== evData.comicId) {
                            continue;
                        }
                        bmcDb.getComic(evData.comicId, (err, comic) => {
                            if (comic === null) {
                                return;
                            }
                            const source = comic.getSource(evData.comicSource);
                            if (source === null) {
                                return;
                            }
                            let sources = Array.prototype.slice.call(mangas[i].getElementsByClassName('nested'));
                            if (sources.length < 1) {
                                return;
                            }
                            // Check if the source is already present
                            sourcesRef = Array.prototype.slice.call(sources[0].getElementsByClassName('label'));
                            for (let y = 0; y < sourcesRef.length; ++y) {
                                if (sourcesRef[y].innerText === evData.comicSource) {
                                    // FIXME: maybe use localization in here?
                                    console.log(`Source "${sourcesRef[y].innerText}" already present, no need to add it.`);
                                    return;
                                }
                            }
                            mangaList.generateSource(comic, source, sources[0]);
                        });
                    }
                } else if (evData.operation === 'Register Comic') {
                    // First, let's check if the manga isn't already in the list...
                    const mangas = Array.prototype.slice.call(document.getElementsByClassName('mangaListItem'));
                    for (let i = 0; i < mangas.length; ++i) {
                        // div.mangaListItem > div.label-container > div.label
                        const manga = mangas[i].firstChild.firstChild;
                        if (manga.bmcData.id !== evData.comicId) {
                            console.log(`Manga "${manga.innerText}" already present, no need to add it.`);
                            return;
                        }
                    }
                    bmcDb.getComic(evData.comicId, (err, comic) => {
                        if (comic === null) {
                            return;
                        }
                        mangaList.generateComic(comic);
                    });
                }
            }
        });

    // Now that we're ready, we can ask to the UI handler to check if we have to open the sidebar
    // or not.
    window.top.postMessage({'type': 'action', 'action': 'CheckSidebar'}, '*');
}

var mangaList = new BmcMangaList();
mangaList.generate();
addEvents(mangaList);


/*
 * This function ensures the transition CSS class is absent, changes the
 * background color (static, instantaneous).
 * Then, it applies the transform class, and finally changes the color back to
 * the original color. This creates a smooth transform from the provided color
 * parameter to the original color.
 */
function triggerTransition(elem, color) {
    // If a transition was already triggered, we expect .style.backgroundColor
    // to be set, while getting the computed style ensure we get a value (even
    // in the first call of this function for that element).
    //
    // If not already triggered, we get the final computed backgroundColor
    // (from CSS sheet).
    //
    // Note that if we only rely on the computed style, we might get a color
    // from an ongoing transition, messing up the expected values if the
    // transitions are somehow triggered multiple times (which can happen if we
    // reconfigure/reload parts of the objects from BookMyComics).
    //
    const origColor = elem.style.backgroundColor || getComputedStyle(elem).backgroundColor;

    // -> Ensure it's not present when setting the color
    elem.classList.remove('notif-transform');

    // Now set the color to transition from
    elem.style.backgroundColor = color;

    /*
     * /!\ NOTE IMPORTANT /!\
     * Accessing a DOM property seems to force a redraw, preventing browser
     * optimization on style settings (by batching updates) which might
     * actually hide the transition.
     * /!\ NOTE IMPORTANT /!\
     */
    void elem.offsetHeight;

    // Add the transition effect _before_ changing the color
    elem.classList.add('notif-transform');

    // And finally set the color to get back to (original color)
    // => This triggers the actual transition effect
    elem.style.backgroundColor = origColor;

    // Remove all mentions of transitions after 2 secs
    setTimeout(() => {
        removeTransitions();
    }, 2000);
}

function removeTransitions() {
    LOGS.warn('E0015');
    const togBtn = document.getElementById('hide-but');
    togBtn.classList.remove('notif-transform');
}

function notifyResult(operation, error) {
    let transitionColor = error ? '#ff0000' : '#00ff00';
    const togBtn = document.getElementById('hide-but');
    triggerTransition(togBtn, transitionColor);
    if (error) {
        LOGS.error('E0016', {operation, 'error': error.message});
    }
}

function shiftButtonRight(btn) {
    if (btn) {
        btn.classList.add('right');
        btn.classList.remove('left');
    }
}

function shiftButtonLeft(btn) {
    if (btn) {
        btn.classList.remove('right');
        btn.classList.add('left');
    }
}

function showHideSidePanel() {
    var evData = {
        type: 'action',
        action: null,
    };
    var togBtn = document.getElementById('hide-but');
    var regBtn = document.getElementById('register-but');
    var delBtn = document.getElementById('delete-but');
    var panel = document.getElementById('side-panel');

    // Ensure no transition will be ongoing after the state change.
    // removeTransitions();

    // Now, do the actual toggling
    if (panel.style.display !== 'block') {
        evData.action = 'ShowSidePanel';
        panel.style.display = 'block';
        togBtn.innerText = '<';
        shiftButtonRight(togBtn);
        delBtn.style.display = '';
        regBtn.style.display = '';
        togBtn.style.top = '100px';
    } else {
        evData.action = 'HideSidePanel';
        panel.style.display = '';
        togBtn.innerText = '>';
        shiftButtonLeft(togBtn);
        if (mangaList.isRegistered === true) {
            delBtn.style.display = 'block';
        } else if (mangaList.isRegistered === false) {
            regBtn.style.display = 'block';
        }
        togBtn.style.top = '';
    }
    // Notify top window of the SidePanel action
    window.top.postMessage(evData, '*');
}

function switchSelectedEntry() {
    if (this.classList.contains('selected')) {
        this.classList.remove('selected');
        document.getElementById('add-existing-confirm').disabled = true;
    } else {
        const nested = cloneArray(this.parentElement.getElementsByClassName('selected'));
        for (var i = 0; i < nested.length; ++i) {
            nested[i].classList.remove('selected');
        }
        this.classList.add('selected');
        document.getElementById('add-existing-confirm').disabled = false;
    }
}

function showHideAddIntoExisting() {
    var sidePanelAdder = document.getElementById('side-panel-adder');
    var sidePanelAddIntoExisting = document.getElementById('side-panel-add-into-existing');

    if (sidePanelAddIntoExisting.style.display !== 'block') {
        sidePanelAdder.style.display = '';
        sidePanelAddIntoExisting.style.display = 'block';
        // Fill list of available entries.
        var entries = document.getElementById('existing-entries');
        emptyElem(entries);

        // Now that the parent is a clean slate, let's generate
        bmcDb.list((err, comics) => {
            comics.forEach(
                comic => {
                    var entry = document.createElement('div');
                    entry.innerText = comic.label;
                    entry.bmcData = {
                        id: comic.id,
                    };
                    entry.onclick = switchSelectedEntry;
                    entries.appendChild(entry);
                }
            );
        });
    } else {
        sidePanelAdder.style.display = 'block';
        sidePanelAddIntoExisting.style.display = '';
    }
}

function showHideSidePanelAdder() {
    var sidePanel = document.getElementById('side-panel');
    var sidePanelAdder = document.getElementById('side-panel-adder');
    var hideBut = document.getElementById('hide-but');
    var regBtn = document.getElementById('register-but');
    var delBtn = document.getElementById('delete-but');

    if (sidePanelAdder.style.display === 'block') {
        let prev = sidePanel.getAttribute('prev');
        sidePanel.style.display = prev;
        sidePanel.setAttribute('prev', '');
        sidePanelAdder.style.display = '';
        hideBut.style.display = '';
        if (prev === '') {
            // Force iframe to non full size.
            window.top.postMessage({'type': 'action', 'action': 'IFrameResize'}, '*');
            if (mangaList.isRegistered === true) {
                delBtn.style.display = 'block';
            } else if (mangaList.isRegistered === false) {
                regBtn.style.display = 'block';
            }
        } else {
            // Show sidebar.
            window.top.postMessage({'type': 'action', 'action': 'ShowSidePanel'}, '*');
        }
    } else {
        var bookmarkName = document.getElementById('bookmark-name');
        var confirmBut = document.getElementById('add-confirm');

        sidePanel.setAttribute('prev', sidePanel.style.display);

        // Force iframe to full size.
        window.top.postMessage({'type': 'action', 'action': 'IFrameResize', 'fullSize': 'true'}, '*');

        sidePanel.style.display = 'none';
        sidePanelAdder.style.display = 'block';
        bookmarkName.value = '';
        bookmarkName.focus();
        confirmBut.disabled = true;
        regBtn.style.display = '';
        delBtn.style.display = '';
        hideBut.style.display = 'none';
    }
}

function showHideSidePanelDeleter() {
    if (!mangaList.currentComic) {
        LOGS.error('E0020');
    }
    mangaList.sourceDelete(mangaList.currentComic.id, mangaList.currentComic.reader,
                           mangaList.currentComic.name);
}
