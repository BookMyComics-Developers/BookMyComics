/**
 *
 */

function BmcUI(messagingHandler) {
    this._messaging = messagingHandler;
}

function isChrome() {
    return window.chrome !== undefined;
}

BmcUI.prototype.INFOBAR_ID = 'BmcInfoBar';
BmcUI.prototype.SIDEPANEL_ID = 'BmcSidePanel';

BmcUI.prototype.makeInfobar = function(resourcePath) {
    var height = '40px';
    var iframe = document.createElement('iframe');
    iframe.id = this.INFOBAR_ID;
    iframe.src = resourcePath;
    console.log(`Inserting iframe src=${iframe.src}`);
    iframe.style.width = '100vw';
    iframe.style.height = height;
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.zIndex = '1000001'; // Some high value
    iframe.style.border = 'none';
    // Etc. Add your own styles if you want to
    document.documentElement.appendChild(iframe);

    // Ensure that he added toolbar will "shift" the page's content downwards
    // to avoid the overlay effect, and instead actually insert it at the top
    var bodyStyle = document.body.style;
    var cssTransform = 'transform' in bodyStyle ? 'transform' : 'webkitTransform';
    bodyStyle[cssTransform] = 'translateY(' + height + ')';
    //
    // Message sending is useless to handle for the Infobar,
    // since the infobar communicates directly to the sidebar (same-domain
    // cross-iframe javascript control); and the sidebar is the one controlling
    // the actual logic of the addon.
    //
    // Thus, the side-bar showing controlled by the infobar will automatically
    // hide the infobar when necessary, through sidebar <-> Host-window
    // messaging.
};

BmcUI.prototype.buildSidePanel = function(setupTracker, resourcePath) {
    var height = '100vh';
    var iframe = document.createElement('iframe');
    iframe.id = this.SIDEPANEL_ID;
    iframe.src = resourcePath;
    console.log(`Inserting iframe src=${iframe.src}`);
    iframe.style.width = '200px';
    iframe.style.height = '100vh';
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.zIndex = '1000000'; // Some high value
    iframe.style.border = 'none';
    // Etc. Add your own styles if you want to
    document.documentElement.appendChild(iframe);
    this._messaging.addWindowHandler(
        this.SIDEPANEL_ID,
        evData => evData.type === 'action' && evData.action === 'HideSidePanel',
        evData => {
            console.log('Hiding Side-Panel: Re-setting up tracker');
	        // Do not check if infobar is still around.
	        // -> It's NOT supposed to be.
            setupTracker();
        });
    this._messaging.addWindowHandler(
        this.SIDEPANEL_ID,
        evData => evData.type === 'action' && evData.action === 'ShowSidePanel',
        evData => {
            console.log('Showing Side-Panel: Hiding tracker');
            this.removeRegisterDialog();
        });
};

BmcUI.prototype.makeRegisterDialog = function(comicName, chapter, page) {
    var bro = getBrowser();
    this.makeInfobar(bro.runtime.getURL('register-diag.html'));
};

BmcUI.prototype.removeRegisterDialog = function() {
    const infobar = document.getElementById(this.INFOBAR_ID);
    if (infobar) {
        infobar.parentNode.removeChild(infobar);
    }
    this._messaging.removeWindowHandlers(this.INFOBAR_ID);
};

BmcUI.prototype.makeSidePanel = function(setupTracker, comicName, chapter, page) {
    var bro = getBrowser();
    const reader = window.location.hostname;
    this.buildSidePanel(setupTracker, bro.runtime.getURL('sidebar.html')
        + `?reader=${reader}&comicName=${encodeURIComponent(comicName)}&chapter=${chapter}&page=${page}`);
};

BmcUI.prototype.removeSidePanel = function() {
    const sidepanel = document.getElementById(this.SIDEPANEL_ID);
    sidepanel.parentNode.removeChild(sidepanel);
    this._messaging.removeWindowHandlers(this.SIDEPANEL_ID);
};

BmcUI.prototype.makeTrackingNotification = function(err) {
    if (err) {
        alert('BookMyComic: BmcUI.makeTrackingNotification: Could not save comic progress: ' + err.message);
        return ;
    }
    alert('BookMyComic: BmcUI.makeTrackingNotification: progress saved');
};
