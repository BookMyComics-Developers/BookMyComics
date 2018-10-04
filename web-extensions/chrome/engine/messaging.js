/**
 * This global object is an array containing the various BmcMessageHandler
 * objects used by the page to handle its internal communication events.
 * This object should never be accessed directly, but accessed through a
 * BmcMessagingHandlers object.
 *
 * @global
 */
var BmcWindowHandlers = [];


/**
 * A function that tells whether an event should be handled by the associated
 * BmcMEssageHandler~HandlerFunction, by checking the event's object provided
 * as parameter.
 *
 * @callback BmcMessageHandler~SelectorFunction
 *
 * @params {Object} evData - The event's object
 *
 * @returns {undefined}
 */

/**
 * A function that handles an event by accepting the event's object as
 * parameter.
 *
 * @callback BmcMessageHandler~HandlerFunction
 *
 * @params {Object} evData - The event's object
 *
 * @returns {undefined}
 */

/**
 * This function is the constructor for the BmcMessageHandler class
 * This class is used as a wrapper to hold all informations regarding one
 * specific handler. A collection of these handlers can be found in the
 * `BmcWindowHandlers` global variable, and shall be manipulated through the
 * BmcMessagingHandler framework-class.
 *
 * @class
 *
 * @params {string} tag - a tag to identify a group of Handlers with for
 *                        grouped removal
 * @params {BmcMessageHandler~SelectorFunction} selector - a function to tell
 *                        whether the handler wants to be called for the
 *                        handled event.
 * @params {BmcMessageHandler~HandlerFunction} handler - the function to apply
 *                        to the event if the selector for this handler
 *                        returned truc
 */
function BmcMessageHandler(tag, selector, handler) {
    this.tag = tag;
    this.select = selector;
    this.handle = handler;
}

/**
 * This function is the constructor for the BmcMessagingHandler class
 * This class is used as a messaging framework, which stores its data globally
 * (through the `BmcWindowHanlders` variable).
 *
 * @class
 *
 */
function BmcMessagingHandler() {
    this._setup = false;
}

/**
 * This function shall only be called once by the BmcMessagingHandler class.
 * It sets up one global eventHandler function for the 'message' events, and
 * handles various event Handlers through the BmcWindowHandlers variable and
 * its BmcMessageHandle objects.
 * This method allows a finer control over the Handlers managed by the
 * BmcMessagingHandlers class.
 *
 * @method
 */
BmcMessagingHandler.prototype.setupMessaging = function() {
    // Setup the cross-window (iframe actually) messaging to get notified when
    // the iframe will have spent its usefulness.
    window.addEventListener('message', event => {
        if (event.type === 'message') {
            if (typeof(event) === 'Error') {
                console.log(`Got message error: ${JSON.stringify(err, ["message", "arguments", "type", "name"])}`);
                return ;
            }

            /*
             * NOTE
             * Origin is actually shown as the extension's internal URL, so
                 * let's retrieve it using runtime.getURL(''); and compare the
             * origin against it.
             * Note that the origin does not include an ending '/' while the
             * URL of the extension does, hence the 'indexOf' method rather
             * than a simple '===' comparison.
             */
            var bro = getBrowser();
            var bmcOrigin = bro.runtime.getURL('');
            if (bmcOrigin.indexOf(event.origin) !== -1) {
                var eventData = event.data;
                if (typeof(eventData) !== 'object') {
                     console.warn('BmcMessagingHandler: EventData is of unexpected type');
                     return ;
                }
                BmcWindowHandlers.forEach(handler => {
                    if (handler.select(eventData)) {
                        handler.handle(eventData);
                    }
                });
            }
        }
    });
    this._setup = true;
}

/**
 * This function registers a handler in the messaging system according to the
 * provided handler settings.
 *
 * @method
 *
 * @params {string} tag - a tag to identify a group of Handlers with for
 *                        grouped removal
 * @params {BmcMessageHandler~SelectorFunction} selector - a function to tell
 *                        whether the handler wants to be called for the
 *                        handled event.
 * @params {BmcMessageHandler~HandlerFunction} handler - the function to apply
 *                        to the event if the selector for this handler
 *                        returned true
 */
BmcMessagingHandler.prototype.addWindowHandler = function(tag, selector, handler) {
    BmcWindowHandlers.push(new BmcMessageHandler(tag, selector, handler));
    if (this._setup === false) {
        this.setupMessaging();
    }
}


/**
 * This function removes all handlers which tag match the parameter provided.
 * It is useful to "unregister" a specific component (thus by removing all
 * related listeners, identified by a chosen tag).
 *
 * @method
 *
 * @params {string} tag - a name to identify the groups of handlers to be
 *                        removed from the messaging framework
 */
BmcMessagingHandler.prototype.removeWindowHandlers = function(tag) {
    BmcWindowHandlers = BmcWindowHandlers.filter(handler => handler.tag !== tag);
}
