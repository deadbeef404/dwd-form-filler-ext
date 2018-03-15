var FILTER_BY_DOMAIN = 'domain';
var FILTER_BY_PATH = 'path';
var FILTER_BY_FULL = 'full';

function fits(current, storage) {
    var value = localStorage.getItem('filter');

    current = current.toLowerCase();
    storage = storage.toLowerCase();

    var url1 = parseUri(current);
    var url2 = parseUri(storage);
	
    if (storage === '*') {
        return true;

    } else if (value === FILTER_BY_DOMAIN) {
        return url1.host === url2.host;

    } else if (value === FILTER_BY_PATH) {
        return (url1.protocol + url1.host + url1.path) == (url2.protocol + url2.host + url2.path);

    } else if (value === FILTER_BY_FULL) {
        return current == storage;

    } else {
        console.error('WebFormFiller: filter value is wrong: ' + value);
        return true;
    }
}

async function getSetsForCurrentUrl(url) {
    var sets = [];

    if (window.STORE_TO_PROFILE) {
      var result = await chrome.storage.sync.get(null);
      for (var i = 0; i < Object.keys(result).length; i++) {
          var storageKey = Object.keys(result)[i];
          var key = result[storageKey].key;
          if (key == 'filter') {
              continue;
          }

          var settings = JSON.parse(result[storageKey]);

          if (fits(url, settings.url)) {
              settings.key = key;
              sets.push(settings);
          }
      }
      return sets;
    }

    // The old `localStorage` way!
    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key == 'filter') {
            continue;
        }

        var settings = JSON.parse(localStorage.getItem(key));

        if (fits(url, settings.url)) {
            settings.key = key;
            sets.push(settings);
        }
    }

    return sets;
}
