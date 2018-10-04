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
    iframe.style.zIndex = '1000000'; // Some high value
    iframe.style.border = 'none';
    // Etc. Add your own styles if you want to
    document.documentElement.appendChild(iframe);

    // Ensure that he added toolbar will "shift" the page's content downwards
    // to avoid the overlay effect, and instead actually insert it at the top
    var bodyStyle = document.body.style;
    var cssTransform = 'transform' in bodyStyle ? 'transform' : 'webkitTransform';
    bodyStyle[cssTransform] = 'translateY(' + height + ')';
    this._messaging.addWindowHandler(
        this.INFOBAR_ID,
        evData => evData.type === 'action' && evData.action === 'RemoveInfoBar',
        evData => {
            try {
                var data = JSON.parse(event.data);
            } catch(e) {
                console.log(e);
                return;
            }
            iframe.parentNode.removeChild(iframe);
        });
};

BmcUI.prototype.buildSidePanel = function(resourcePath) {
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
    iframe.style.zIndex = '1000001'; // Some high value
    iframe.style.border = 'none';
    // Etc. Add your own styles if you want to
    document.documentElement.appendChild(iframe);
    this._messaging.addWindowHandler(
        this.SIDEPANEL_ID,
        evData => true,
        evData => {
            try {
                var data = JSON.parse(event.data);
            } catch(e) {
                console.log(e);
                return;
            }
            console.log('message received: ' + data['comicName']);
        });
};

BmcUI.prototype.makeRegisterDialog = function() {
    var bro = getBrowser();
    this.makeInfobar(bro.runtime.getURL('register-diag.html'));
};

BmcUI.prototype.removeRegisterDialog = function() {
    const infobar = document.getElementById(this.INFOBAR_ID);
    infobar.parentNode.removeChild(infobar);
    this._messaging.removeWindowHandlers(this.INFOBAR_ID);
};

BmcUI.prototype.makeSidePanel = function() {
    var bro = getBrowser();
    this.buildSidePanel(bro.runtime.getURL('sidebar.html'));
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
