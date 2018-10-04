document.getElementById('register').addEventListener('click', () => {
    console.log('Clicked "AddComic"');

   const dataObj = {
       type: 'action',
       action: 'AddComic',
   };
   return window.parent.postMessage(JSON.stringify(dataObj), '*');
});

console.log('Register InfoBar setup done.');
