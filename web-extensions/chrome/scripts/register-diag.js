document.getElementById('register').addEventListener('click', () => {
    console.log('Clicked "AddComic"');

    // Control the side panel directly, to display it and switch it to the
    // "register" mode (so that the buttons may trigger the alias recording
    // operation, rather than send to the comic's page)
    //
    // Note that showing the SidePanel will automatically hide the Infobar, so
    // there is no need to communicate with the parent window from the infobar.
    //
    console.log('Operating SidePanel mode switch.');
    // Find the right frame window first
    let sideFrame = null;
    for (var i = 0; i < window.parent.length; ++i) {
        var frame = window.parent.frames[i];
        if (frame.showHideSidePanel) {
            sideFrame = frame;
            break ;
        }
    }
    // Change the SidePanel mode to "register" then display it
    sideFrame.showHideSidePanel();
});

console.log('Register InfoBar setup done.');
