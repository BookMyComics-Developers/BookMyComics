console.log(`URL is : ${document.location.search}`);
const uriParams = document.location.search.split('?')[1].split('&');
const comicName = decodeURI(uriParams[0].split('=')[1]);
const chapter = uriParams[1].split('=')[1];
const page = uriParams[2].split('=')[1];
console.log(`BmcInfoBar: comic ${comicName}, chapter=${chapter}, page=${page}`);
document.getElementById('register').addEventListener('click', () => {
    console.log('Clicked "AddComic"');

   const dataObj = {
       type: 'action',
       action: 'AddComic',
   };
   return window.parent.postMessage(JSON.stringify(dataObj), '*');
});

console.log('Register InfoBar setup done.');
