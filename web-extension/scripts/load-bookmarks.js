/* globals
    BmcComic:readable
    BmcComicSource:readable
    BmcStorageFactory:readable
    BmcDataAPI:readable
    BmcSidebarMessagingHandler:readable
    BmcUI:readable
    LOGS:readable
    cloneArray:readable
    BmcSettings:readable
*/

const uriParams = document.location.search.split('?')[1].split('&');
const hostOrigin = decodeURIComponent(uriParams[0].split('=')[1]);
LOGS.log('S44', {'origin': hostOrigin});

function BmcMangaList(messaging, db) {
    this._node = document.getElementById('manga-list');
    this.currentComic = null;
    this.currentSource = null;
    this.comics = [];
    this._comms = messaging;
    this._db = db;
}

function emptyElem(elem) {
    // NOTE: This method seems to be the most efficient as shown by
    // https://jsperf.com/innerhtml-vs-removechild/15
    while (elem.firstChild) {
        elem.removeChild(elem.firstChild);
    }
}

function updateErrorDisplay(err) {
    let disp = document.getElementById('error-display');
    if (err !== null && err !== undefined && err !== '') {
        disp.innerText = err.message;
        disp.style.display = 'block';
    } else {
        disp.style.display = '';
    }
}

function sendAliasRequest(db, comicId) {
    db.getComic(comicId, (err, comic) => {
        let label = '<unknown manga>';
        if (comic !== null) {
            label = comic.label;
        }
        LOGS.log('S46', {'id': comicId, 'label': label});
        const evData = {
            type: 'action',
            action: 'alias',
            comic: comic.serialize(),
            source: mangaList.currentSource.toDict(),
        };
        bmcMessaging.sendExtension(evData);
    });
}

function getRefreshBut() {
    return document.getElementById('refresh-but');
}

BmcMangaList.prototype.onBrowseClick = function(ev) {
    let target = ev.target;
    let comicWrapper = target.parentElement;
    while (!comicWrapper.classList.contains('mangaListItem')) {
        // It means we clicked on the margin part, making the target the parent element.
        comicWrapper = comicWrapper.parentElement;
    }
    if (target.classList.contains('label-container')) {
        target = target.children[0];
    }
    const nested = cloneArray(comicWrapper.getElementsByClassName('nested'));
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
            id: comic.id,
            reader: source.reader,
        },
    };
    /*
     * Here, we send a message to the extension script (background page), in
     * order to have it generate the final link from the `(comicId, reader)`
     * tuple that we provide. This will guarantee that we always generate the
     * link to the last registered chapter/page, as opposed to saving link/data
     * in the DOM.
     *   Then, a message is sent to the top frame (ie: "Host page") to trigger
     * the change or URL and load the requested page.
     *
     * Note that this approach has multiple reasons/causes:
     * - We do not want to load all "support" scripts in the sidebar or host
     *   pages, to keep the manifest as concise as possible
     * - We do not want to allow changing the URL from the extension script,
     *   as it would require wider privileges that we want to keep minimal
     * - Sidebar is unable, since it's related to the extension exclusively, to
     *   change the host page's URL, and thus must delegate this to the script
     *   injected into the host page.
     *
     * As a summary, this means in terms of exchange that the following happens:
     * 1. Sidebar sends a `URL:Generate` request to Extension
     * 2. Extension generates the URL and sends it back as a `URL:Generate`
     *    response
     * 3. Sidebar receives the `URL:Generate` responses and forwards the URL to
     *    the host page as an `urlopen` action
     * 4. Host page received the `urlopen` action request and changes the URL
     *    to load the requested one.
     *
     */
    this._comms.sendExtension(ev);
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
        comic: {            // Follows BmcComic model
            id: comicId,
        },
        source: {           // Follows BmcComicSource model
            reader: reader,
            name: name,
        },
    };
    this._comms.sendExtension(evData);
};

BmcMangaList.prototype.onEntryDelete = function(ev) {
    const icon = ev.target;
    const comicDiv = icon.parentElement;
    const comicLabel = comicDiv.firstChild;

    LOGS.debug('S58', { comic: comicLabel.innerText, id: comicLabel.bmcData.id });

    const evData = {
        type: 'action',
        action: 'delete',
        comic: {                        // Follows BmcComic model
            id: comicLabel.bmcData.id,
        },
    };
    this._comms.sendExtension(evData);
};

BmcMangaList.prototype.showRegisterDeleteButton = function() {
    if (this.currentComic === null) {
        showRegisterButton();
        return;
    }
    for (let i = 0, len = this.comics.length; i < len; ++i) {
        const comic = this.comics[i];
        if (comic.id === this.currentComic.id && comic.getSource(this.currentSource.reader) !== null) {
            showDeleteButton();
            return;
        }
    }
    showRegisterButton();
};

BmcMangaList.prototype.generateSource = function(comic, source) {
    const elm = document.createElement('div');
    elm.classList.add('label-container');

    const srcLink = document.createElement('div');
    srcLink.classList.add('label');
    srcLink.innerText = source.reader;
    srcLink.bmcData = {
        reader: source.reader,
        name: source.name,
    };
    srcLink.onclick = this.onSourceClick.bind(this, comic, source);
    elm.appendChild(srcLink);

    const deleteSrcIcon = document.createElement('span');
    deleteSrcIcon.classList.add('fa', 'fa-trash');
    deleteSrcIcon.setAttribute('aria-hidden', 'true');
    deleteSrcIcon.onclick = this.onSourceDelete.bind(this);
    elm.appendChild(deleteSrcIcon);

    return elm;
};

BmcMangaList.prototype.generateComic = function(comic) {
    const elm = document.createElement('div');
    elm.classList.toggle('mangaListItem');

    // Define the content on comic Label's line
    const comicDiv = document.createElement('div');
    comicDiv.classList.add('label-container');
    comicDiv.onclick = this.onBrowseClick;
    elm.appendChild(comicDiv); // elm.comicDiv(0)

    const comicLabel = document.createElement('div');
    comicLabel.classList.add('label', 'rollingArrow');
    comicLabel.innerText = comic.label;
    comicLabel.bmcData = {
        id: comic.id,
    };
    comicDiv.appendChild(comicLabel); // elm.comicDiv(0).comicLabel(0)

    const deleteIcon = document.createElement('span');
    deleteIcon.classList.add('fa', 'fa-trash');
    deleteIcon.setAttribute('aria-hidden', 'true');
    deleteIcon.onclick = this.onEntryDelete.bind(this);
    comicDiv.appendChild(deleteIcon); // elm.comicDiv(0).deleteIcon(1)

    // Define the list of sources beneath the comic's Label
    const comicSrcList = document.createElement('div');
    comicSrcList.classList.toggle('nested');
    elm.appendChild(comicSrcList); // elm.comicSrcList(1)

    comic.iterSources(source => {
        // elm.comicSrcList(1).Comic(index)
        comicSrcList.appendChild(this.generateSource(comic, source));
        setSourceUpdate(source.info.has_updates, comicLabel, comicSrcList.lastChild.children[0]);
    });

    return elm;
};

// Beware, this function shall only be used to update an existing, complete and
// displayed BMCMangaList.
BmcMangaList.prototype.appendComic = function(comicDOM) {
    this._node.insertBefore(comicDOM, this._node.lastChild);
};

BmcMangaList.prototype.refreshComic = function(comicDOM) {
    let origElem = null;
    for (let i = 0; i < this._node.children.length; ++i) {
        // mangaList.mangaListItem.comicDiv.comicLabel.bmcData.id
        if (this._node.children[i].children[0].children[0].bmcData.id
                      === comicDOM.children[0].children[0].bmcData.id) {
            // Replace the old comic entry by the new
            this._node.replaceChild(comicDOM, this._node.children[i]);
            break ;
        }
    }
    if (origElem === null) {
        LOGS.error('S73');
        return ;
    }
};

BmcMangaList.prototype.generate = function(completionCb) {
    LOGS.log('S49');

    // Now that the parent is a clean slate, let's generate
    this._db.list((err, comics) => {
        // First, remove any child node, to ensure it's clean before we start
        // generating.
        emptyElem(this._node);
        this.comics = comics;

        comics.forEach(
            comic => { this._node.appendChild(this.generateComic(comic)); }
        );

        // Insert a last non-visible item, which acts as the "finalization" of the
        // list loading. It is used by testing to identify when all items have been loaded.
        var marker = document.createElement('span');
        marker.id = 'manga-list-end-marker';
        this._node.appendChild(marker);
        this.showRegisterDeleteButton();

        // Now, ensure the active comic (if set) is highlighted.
        updateMangaListItem(this.currentComic, this.currentSource, setActiveComic);

        // Finally, call completion cb if set
        if (completionCb) {
            completionCb();
        }
    });
};


BmcMangaList.prototype.hideEntry = function(entry) {
    entry.style.display = 'none';
};

BmcMangaList.prototype.showEntry = function(entry) {
    entry.style.display = '';
};

// This function checks that all letters from `match` are present in `value` in the same order.
BmcMangaList.prototype.match = function(value, match) {
    let lvalue = value.toLowerCase();
    const lmatch = match.toLowerCase();
    for (let i = 0, len = lmatch.length; i < len; ++i) {
        let idx = lvalue.indexOf(lmatch[i]);
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
        const entryLabel = cloneArray(entry.getElementsByClassName('label'));
        if (entryLabel.length > 0) {
            if (this.match(entryLabel[0].innerText, filterStr)) {
                this.showEntry(entry);
            } else {
                this.hideEntry(entry);
            }
        }
    }
};

BmcMangaList.prototype.askComicInformation = function() {
    const evData = {
        type: 'query',
        action: 'Comic Information',
    };
    this._comms.sendWindow(evData);
};

function showDeleteButton() {
    if (!mangaList.currentSource) {
        return;
    }
    document.getElementById('delete-but').style.display = 'block';
    document.getElementById('register-but').style.display = '';
}

function showRegisterButton() {
    if (!mangaList.currentSource) {
        return;
    }
    document.getElementById('register-but').style.display = 'block';
    document.getElementById('delete-but').style.display = '';
}

function changeConfirmButtonStatus(db, confirmBut, value) {
    // Do various validity checks here, which may disable the confirm button:
    db.checkLabelAvailability(value.trim(), err => { // ignore optional second param
        updateErrorDisplay(err);
        confirmBut.disabled = (err !== null) || (value.trim().length === 0);
    });
}

function getDomSourcesFromComic(comicLabel) {
    // two levels of parent Elements to go from label to mangaListItem DOM node
    return cloneArray(comicLabel.parentElement.parentElement.querySelectorAll('.nested .label'));
}

function setActiveComic(comicLabel, sourceLabel) {
    comicLabel.parentElement.classList.add('current');
    if (sourceLabel) {
        sourceLabel.parentElement.classList.add('current');
    }
}

function setSourceUpdate(has_updates, comicLabel, sourceLabel) {
    if (!sourceLabel)
        return ;

    if (has_updates) {
        comicLabel.parentElement.classList.add('readable');
        sourceLabel.parentElement.classList.add('readable');
    } else {
        sourceLabel.parentElement.classList.remove('readable');
        const sources = getDomSourcesFromComic(comicLabel);
        if (sources.some(s => s.parentElement.classList.contains('readable')) == 0) {
            comicLabel.parentElement.classList.remove('readable');
        }
    }
}

function updateMangaListItem(refComic, refSource, transformCb) {
    const items = cloneArray(
        document.getElementById('manga-list').getElementsByClassName('mangaListItem'));
    for (let i = 0, len = items.length; i < len; ++i) {
        const item = items[i];
        const label = item.getElementsByClassName('rollingArrow')[0];
        if (refComic && label.bmcData.id === refComic.id) {
            const sources = getDomSourcesFromComic(label);
            for (i = 0; i < sources.length; ++i) {
                const source = sources[i];
                if (source.innerText === refSource.reader) {
                    return transformCb(label, source);
                }
            }
            return transformCb(label, null);
        }
    }
}

function addEvents(db, messaging) {
    // Clicking on the `>`/`<` button will show/hide the panel
    var but = document.getElementById('hide-but');
    but.onclick = () => mangaList.generate(showHideSidePanel);

    // Input in searchbox will filter the list of mangas
    var sbox = document.getElementById('searchbox');
    sbox.oninput = function() {
        LOGS.log('S51');
        var str = sbox.value;
        mangaList.filter(str);
    };

    function confirmBookmark() {
        const label = document.getElementById('bookmark-name').value.trim();
        if (label.length < 1 || confirmBut.disabled) {
            return;
        }
        // Disable button for now, Callback will switch back to manga-list view
        confirmBut.disabled = true;
        // Now do the actual registration.
        const evData = {
            type: 'action',
            action: 'register',
            label,
            comic: mangaList.currentComic.serialize(),
            source: mangaList.currentSource.toDict(),
        };
        messaging.sendExtension(evData);
    }

    // On button-add click, Trigger a new comic registration
    const refreshBtn = getRefreshBut();
    if (refreshBtn) {
        refreshBtn.onclick = checkForUpdates;
    }
    const regBtn = document.getElementById('register-but');
    if (regBtn) {
        regBtn.onclick = () => showHideSidePanelAdder(db);
    }
    const delBtn = document.getElementById('delete-but');
    if (delBtn) {
        delBtn.onclick = showHideSidePanelDeleter;
    }

    var addIntoExistingBut = document.getElementById('add-into-existing');
    if (addIntoExistingBut) {
        addIntoExistingBut.onclick = () => showHideAddIntoExisting(db);
    }
    var cancelBut = document.getElementById('add-cancel');
    if (cancelBut) {
        cancelBut.onclick = () => showHideSidePanelAdder(db);
    }
    var confirmBut = document.getElementById('add-confirm');
    if (confirmBut) {
        confirmBut.onclick = confirmBookmark;
    }
    var confirmExistingBut = document.getElementById('add-existing-confirm');
    if (confirmExistingBut) {
        confirmExistingBut.onclick = () => {
            const selected = cloneArray(
                document.getElementById('existing-entries')
                    .getElementsByClassName('selected'));
            if (selected.length === 0) {
                LOGS.log('S64');
                return;
            }
            // We send the message to add into the DB.
            sendAliasRequest(db, selected[0].bmcData.id);
            // We hide the current panel.
            showHideAddIntoExisting(db);
            // Disable confirm button, callback will switch back to manga-list
            // view
            confirmBut.disabled = true;
        };
    }
    var cancelExistingBut = document.getElementById('add-existing-cancel');
    if (cancelExistingBut) {
        cancelExistingBut.onclick = () => {
            // Hide current panel to go back to the "adder" one.
            showHideAddIntoExisting(db);
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
        bookmarkName.oninput = () => {
            changeConfirmButtonStatus(db, confirmBut, this.value);
        };
        bookmarkName.onkeyup = function(event) {
            // We check if "ENTER" was pressed.
            if (event.keyCode === 13) {
                event.preventDefault();
                confirmBookmark();
            }
        };
    }
    document.body.addEventListener('keyup', (event) => {
        if (document.getElementById('side-panel-adder').style.display === 'block') {
            // Check if "ESCAPE" is pressed.
            if (event.keyCode === 27) {
                // We hide the sidepanel adder.
                showHideSidePanelAdder(db);
                event.preventDefault();
            }
        }
    });

    messaging.addWindowHandler(
        BmcUI.prototype.SIDEPANEL_ID,
        evData => evData.type === 'action' && evData.action === 'setup' && evData.operation === 'register',
        () => {
            LOGS.log('S54');
        });
    messaging.addWindowHandler(
        BmcUI.prototype.SIDEPANEL_ID,
        evData => evData.type === 'action' && evData.action === 'toggle' && evData.module === 'sidebar',
        () => {
            mangaList.generate(showHideSidePanel);
        });
    messaging.addWindowHandler(
        BmcUI.prototype.SIDEPANEL_ID,
        evData => evData.type === 'action' && evData.action === 'refresh' && evData.module === 'sidebar',
        () => {
            mangaList.generate();
        });
    messaging.addWindowHandler(
        BmcUI.prototype.SIDEPANEL_ID,
        evData => evData.type === 'action' && evData.action === 'notification' &&
                  (evData.operation === 'Comic Information' || evData.operation === 'track'),
        evData => {
            if (evData.error) {
                updateErrorDisplay(evData.error);
                confirmBut.disabled = true;
                // Skip acknowledgement, as this was an error.
                return ;
            }
            mangaList.currentComic = evData.comic === undefined || evData.comic === null ? null : BmcComic.deserialize(evData.comic);
            mangaList.currentSource = evData.source === undefined || evData.source == null ? null : BmcComicSource.fromDict(evData.source);
            mangaList.showRegisterDeleteButton();
            if (evData.operation === 'track') {
                notifyResult(evData.operation, evData.error);
            }
            updateMangaListItem(mangaList.currentComic, mangaList.currentSource, setActiveComic);
            if (evData.comic && evData.comic.id !== undefined) {
                // Since we're being notified of a comic tracking, we might as well
                // trigger the check for updates directly for this comic
                // Our notification handling message will update the sidebar accordingly
                messaging.sendExtension({
                    type: 'action',
                    action: 'check-for-update',
                    comic: Object.assign({}, evData.comic),
                });
            }
        });
    messaging.addExtensionHandler(
        BmcUI.prototype.SIDEPANEL_ID,
        ev => ev.data.type === 'computation'
           && ev.data.module === 'sources'
           && ev.data.computation === 'URL:Generate:Response',
        ev => {
            if (ev.data.err || !ev.data.resource) {
                LOGS.warn('E0013', {'err': ev.data.err});
                return undefined;
            }
            if (ev.data.resource.err) {
                LOGS.warn('E0014', {'err': ev.data.resource.err});
                return undefined;
            }
            let localEv = {
                type: 'action',
                action: 'urlopen',
                url: ev.data.resource.url,
            };
            // Let the content script at the page's root handle the URL opening
            messaging.sendWindow(localEv);
        });
    messaging.addExtensionHandler(
        BmcUI.prototype.SIDEPANEL_ID,
        ev => ev.data.type === 'action' && ev.data.action === 'notification',
        ev => {
            LOGS.log('S53', {'op': ev.data.operation, 'error': JSON.stringify(ev.data.error)});
            notifyResult(ev.data.operation, ev.data.error);
        });
    messaging.addExtensionHandler(
        BmcUI.prototype.SIDEPANEL_ID,
        ev => ev.data.type === 'action' && ev.data.action === 'notification' &&
                  (ev.data.operation === 'Alias Comic'
                    || ev.data.operation === 'Register Comic'
                    || ev.data.operation === 'Delete Comic Source'
                    || ev.data.operation === 'Delete Comic'),
        ev => {
            if (ev.data.error) {
                updateErrorDisplay(ev.data.error);
                confirmBut.disabled = true;
                // Skip acknowledgement, as this was an error.
                return ;
            }
            if (ev.data.operation.startsWith('Delete')) {
                mangaList.generate();
            } else {
                const evComic = BmcComic.deserialize(ev.data.comic);
                const evSource = ev.data.source ? BmcComicSource.fromDict(ev.data.source) : null;
                let do_hide = false;
                if (evSource && mangaList.currentSource && evSource.name === mangaList.currentSource.name && evSource.reader === mangaList.currentSource.reader) {
                    mangaList.currentComic.id = evComic.id;
                    do_hide = true;
                }

                db.getComic(evComic.id, (err, comic) => {
                    if (comic === null) {
                        LOGS.error('S74');
                        return ;
                    }
                    mangaList.generate(() => {
                        if (do_hide) {
                            hideSidePanelAdder();
                        }
                    });
                });
            }
        });
    messaging.addExtensionHandler(
        BmcUI.prototype.SIDEPANEL_ID,
        ev => ev.data.type === 'action'
            && ev.data.action === 'notification'
            && ev.data.operation === 'Check Updates',
        ev => {
            if (ev.data.step === 'started') {
                const refreshBut = getRefreshBut();
                refreshBut.style.backgroundColor = '#85dd00';
                refreshBut.querySelector('.fa-rotate').classList.add('rotate');
            } else if (ev.data.step === 'completed') {
                const refreshBut = getRefreshBut();
                refreshBut.style.backgroundColor = '#fcfcfc';
                refreshBut.querySelector('.fa-rotate').classList.remove('rotate');
            } else if (ev.data.step === 'source') {
                const evComic = BmcComic.deserialize(ev.data.comic);
                const evSource = BmcComicSource.fromDict(ev.data.source);
                // UPDATE comic/source coloring depending on new page availability (for non-current comic/source)
                updateMangaListItem(evComic, evSource, setSourceUpdate.bind(this, evSource.info.has_updates));
            }
        });
    messaging.addExtensionHandler(
        BmcUI.prototype.SIDEPANEL_ID,
        ev => ev.data.type === 'action'
            && ev.data.action === 'notification'
            && ev.data.operation === 'import',
        ev => {
            if (ev.data.error) {
                return ; // ignore event
            }
            bmcSettings.refresh((err) => {
                if (err) {
                    // TODO
                    alert(LOGS.getString('', {err: err}));
                    return ;
                }
                // Re-generates the full MangaList contents from tracking data
                mangaList.generate(() => {
                    // TODO
                    //LOGS.log('', {});
                });
            });
        });

    // Now that we're ready, we can ask to the UI handler to check if we have to open the sidebar
    // or not.
    messaging.sendWindow({'type': 'action', 'action': 'CheckSidebar'});
    // Ask for the current comic information.
    mangaList.askComicInformation();
}


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
    elem.classList.remove('hover-transform');
    elem.classList.remove('notif-transform');

    setTimeout(() => {
        // Now set the color to transition from
        elem.style.backgroundColor = color;

        // Add the transition effect _before_ changing the color
        elem.classList.add('notif-transform');

        // And finally set the color to get back to (original color)
        // => This triggers the actual transition effect
        elem.style.backgroundColor = origColor;

        // Remove all mentions of transitions after 2 secs
        setTimeout(() => {
            removeTransitions();
            elem.classList.add('hover-transform');
        }, 2000);
    }, 0);
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

function moveButtonsToTheRightPlace(panel) {
    var refBtn = getRefreshBut();
    var togBtn = document.getElementById('hide-but');
    var regBtn = document.getElementById('register-but');
    var delBtn = document.getElementById('delete-but');

    if (panel.style.display === 'block') {
        shiftButtonRight(refBtn);
        shiftButtonRight(togBtn);
        shiftButtonRight(regBtn);
        shiftButtonRight(delBtn);
        togBtn.innerText = '<';
    } else {
        shiftButtonLeft(refBtn);
        shiftButtonLeft(togBtn);
        shiftButtonLeft(regBtn);
        shiftButtonLeft(delBtn);
        togBtn.innerText = '>';
    }
}

function showHideSidePanel() {
    var evData = {
        type: 'action',
        action: null,
    };
    var panel = document.getElementById('side-panel');

    // Ensure no transition will be ongoing after the state change.
    // removeTransitions();

    // Now, do the actual toggling
    if (panel.style.display !== 'block') {
        evData.action = 'ShowSidePanel';
        panel.style.display = 'block';
    } else {
        evData.action = 'HideSidePanel';
        panel.style.display = '';
    }
    moveButtonsToTheRightPlace(panel);
    // Notify top window of the SidePanel action
    bmcMessaging.sendWindow(evData);
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

function showHideAddIntoExisting(db) {
    var sidePanelAdder = document.getElementById('side-panel-adder');
    var sidePanelAddIntoExisting = document.getElementById('side-panel-add-into-existing');

    if (sidePanelAddIntoExisting.style.display !== 'block') {
        sidePanelAdder.style.display = '';
        sidePanelAddIntoExisting.style.display = 'block';
        // Fill list of available entries.
        var entries = document.getElementById('existing-entries');
        emptyElem(entries);

        // Now that the parent is a clean slate, let's generate
        db.list((err, comics) => {
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

function hideSidePanelAdder() {
    var sidePanelAdder = document.getElementById('side-panel-adder');
    if (sidePanelAdder.style.display !== 'block') {
        return;
    }
    var sidePanel = document.getElementById('side-panel');
    var hideBut = document.getElementById('hide-but');
    let prev = sidePanel.getAttribute('prev');

    sidePanel.style.display = prev;
    sidePanel.setAttribute('prev', '');
    sidePanelAdder.style.display = '';
    hideBut.style.display = '';
    updateErrorDisplay(null); // Reset error display and hide it
    if (prev === '') {
        // Force iframe to non full size.
        bmcMessaging.sendWindow({'type': 'action', 'action': 'IFrameResize'});
    } else {
        // Show sidebar.
        bmcMessaging.sendWindow({'type': 'action', 'action': 'ShowSidePanel'});
    }
    mangaList.showRegisterDeleteButton();
    moveButtonsToTheRightPlace(sidePanel);
}

function showSidePanelAdder(db) {
    var sidePanelAdder = document.getElementById('side-panel-adder');
    if (sidePanelAdder.style.display === 'block') {
        return;
    }
    var sidePanel = document.getElementById('side-panel');
    var hideBut = document.getElementById('hide-but');
    var refreshBtn = getRefreshBut();
    var regBtn = document.getElementById('register-but');
    var delBtn = document.getElementById('delete-but');
    var bookmarkName = document.getElementById('bookmark-name');
    var confirmBut = document.getElementById('add-confirm');

    sidePanel.setAttribute('prev', sidePanel.style.display);

    // Force iframe to full size.
    bmcMessaging.sendWindow({'type': 'action', 'action': 'IFrameResize', 'fullSize': 'true'});

    sidePanel.style.display = 'none';
    sidePanelAdder.style.display = 'block';
    confirmBut.disabled = true;
    bookmarkName.value = '';
    if (mangaList.currentSource !== null && mangaList.currentSource.name !== undefined) {
        bookmarkName.value = mangaList.currentSource.name;
        changeConfirmButtonStatus(db, confirmBut, bookmarkName.value);
    }
    bookmarkName.focus();
    refreshBtn.style.display = '';
    regBtn.style.display = '';
    delBtn.style.display = '';
    hideBut.style.display = 'none';
    moveButtonsToTheRightPlace(sidePanel);
}

function showHideSidePanelAdder(db) {
    var sidePanelAdder = document.getElementById('side-panel-adder');

    if (sidePanelAdder.style.display === 'block') {
        hideSidePanelAdder();
    } else {
        showSidePanelAdder(db);
    }
}

function checkForUpdates() {
    // Now do the actual registration.
    const ev= {
        type: 'action',
        action: 'check-for-updates',
    };
    bmcMessaging.sendExtension(ev);
}

function showHideSidePanelDeleter() {
    if (!mangaList.currentComic) {
        LOGS.error('E0020');
    }
    mangaList.sourceDelete(mangaList.currentComic.id, mangaList.currentSource.reader,
                           mangaList.currentSource.name);
}

LOGS.log('S45');
const bmcMessaging = new BmcSidebarMessagingHandler(hostOrigin);

let mangaList = null;
let bmcDb = null;
const bmcSettings = new BmcSettings();
bmcSettings.refresh((err) => {
    if (err) {
        // TODO
        alert(LOGS.getString('', {err: err}));
        return ;
    }
    let bmcStorageEngine = BmcStorageFactory.new(null /* Let factory choose*/, bmcSettings);
    if (bmcStorageEngine === null)
        alert('BookMyComics could not find a working Storage Engine. Please check the settings.');
    bmcDb = new BmcDataAPI(bmcStorageEngine);
    mangaList = new BmcMangaList(bmcMessaging, bmcDb);
    addEvents(bmcDb, bmcMessaging);
});
