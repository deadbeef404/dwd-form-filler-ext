function getAllSets() {
    var sets = [];

    for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key == 'filter') {
            continue;
        }

        var settings = JSON.parse(localStorage.getItem(key));
        settings.key = key;
        sets.push(settings);
    }

    return sets;
}

function sortBy(property) {
    var sortOrder = 1;
    if (property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function (a, b) {
        var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
        return result * sortOrder;
    }
}

async function refreshSetsList() {
    const table = $('#sets');
    let sets;

    table.find('tbody tr').remove();

    if (table.hasClass('allsets')) {
        sets = getAllSets();
        sets.sort(sortBy('url'));
    } else {
        sets = await getSetsForCurrentUrl();
        sets.sort(sortBy('name'));
    }

    if (sets.length) {
        $('#sets').show();
        $('#nosets').hide();
        $('#clearall').removeClass('disabled');
    } else {
        $('#sets').hide();
        $('#nosets').show();
        //$('#nosets_url').text(url);
        $('#clearall').addClass('disabled');
        return;
    }

    renderSets(sets);

    if (table.hasClass('allsets')) {
        $('#clearall').addClass('disabled');
        renderAdditionalInfo(sets);
    }
}

function renderSets(sets) {
    for (var i = 0; i < sets.length; i++) {
        var set = sets[i];
        var newRow = $('<tr data-key="' + set.key + '"></tr>');
        newRow.append('<td class="restore"><i class="icon-arrow-up"></i> Restore</td>');
        newRow.append('<td class="setName">' + set.name + '</td>');

        var isChecked = set.autoSubmit ? "checked" : "";
        var submitHtml = isChecked
            ? '<i class="icon-ok"></i> <span>Yes</span>'
            : '<i class="icon-remove"></i> <span>No</span>';

        newRow.append('<td class="submit ' + (isChecked ? 'active' : '') + '">' + submitHtml + '</td>');
        newRow.append('<td class="remove"><i class="icon-trash"></i></td>');
        newRow.append('<td class="export"><i class="icon-share-alt"></i></td>');

        var hotkey = set.hotkey;
        newRow.append('<td class="hotkey">' + (hotkey ? hotkey : 'none') + '</a></td>');

        $('#sets').append(newRow);
    }
}

function renderAdditionalInfo(sets) {
    var table = $('#sets');

    if (!table.find('th.url').length) {
        table.find('thead tr').append('<th class="url">URL</th>');
    }

    for (var i = 0; i < sets.length; i++) {
        var set = sets[i];
        var row = table.find('tr[data-key=' + set.key + ']');
        var substrHref = set.url.length > 40 ? set.url.substring(0, 40) + '...' : set.url;
        row.append('<td class="url"><a target="_blank" href="' + set.url + '">' + substrHref + '</a></td>');
    }
}

async function saveValue(tr, property, value) {
    var key = tr.data('key');
    const setSettings = await getSet(key);
    setSettings[property] = value;

    await storeOneSet(key, setSettings)
}

async function getValue(tr, property) {
    var key = tr.data('key');
    const setSettings = await getSet(key);
    return setSettings[property];
}

async function sendMessage(message) {
    const tabs = await chrome.tabs.query({ 'active': true, 'currentWindow': true });
    const response = await chrome.tabs.sendMessage(tabs[0].id, message);
    response.url = tabs[0].url;
    return response
}

function setCurrentFilter() {
    var value = localStorage.getItem('filter');

    if (!value) {
        localStorage.setItem('filter', FILTER_BY_FULL);
        value = FILTER_BY_FULL;
    }

    var link = $('a.filter[id=' + value + ']');
    link.prepend('<i class="icon-ok"></i> ');
}

function getRandomStorageId() {
    var key = Math.floor((Math.random() * 1000000000) + 1);
    if (localStorage.getItem(key)) {
        return Math.floor((Math.random() * 1000000000) + 1);
    }
    return key;
}

function initialiseCheckbox() {
    window.STORE_TO_PROFILE = true;

    $('.storage-toggle').change(function(e) {
        window.STORE_TO_PROFILE = e.target.checked;
        const $labelElement = $(this).closest('label');
        const $buttonTextElement = $(this).find('span');
        const $currentStateElement = $('#current-storage');
        if (window.STORE_TO_PROFILE) {
            $currentStateElement.text("Chrome Profile");
            $buttonTextElement.text('Switch to local sets')
            $labelElement.addClass('using-chrome-storage');
        } else {
            $currentStateElement.text("Local Sets");
            $buttonTextElement.text('Switch to chrome profile sets')
            $labelElement.removeClass('using-chrome-storage');
        }
        refreshSetsList();
    });
}

// Saves the form data to the storage backend.
async function saveFormHandler() {
    const response = await sendMessage({ "action": 'store' });

    var error = $('#error');
    if (!response || chrome.runtime.lastError || response.error) {

        if (chrome.runtime.lastError) {
            error.html('<h6>Error :( Something wrong with current tab. Try to reload it.</h6>');
        } else if (!response) {
            error.html('<h6>Error :( Null response from content script</h6>');
        } else if (response.error) {
            error.html('<h6>Error :\'( ' + response.message + '</h6>');
        }

        error.show();
        return;
    }

    error.hide();

    var key = getRandomStorageId();

    var setInfo = {
        url: response.url,
        name: key,
        autoSubmit: false,
        submitQuery: '',
        content: response.content,
        hotkey: '',
    };

    await storeOneSet(key, setInfo)
    refreshSetsList();
}

async function storeOneSet(key, setInfo) {
    // This `key` attribute is required for deletion at any point.
    setInfo.key = key;

    const dataString = JSON.stringify(setInfo);

    if (window.STORE_TO_PROFILE) {
        await chrome.storage.sync.set({[key]: dataString});
    } else {
        localStorage.setItem(key, dataString);
    }
}

/**
 * Remove data sets from storage.
 *
 * @param {array} keys - List of keys that identify sets to be removed.
 */
async function removeSetOfKeys(keys) {
    if (window.STORE_TO_PROFILE) {
        await chrome.storage.sync.remove(keys.map(key => key.toString()));
    } else {
        for (let i = 0; i < sets.length; i++) {
            localStorage.removeItem(sets[i].key);
        }
    }
}

/**
 * Called when the user has typed a new name for a data set.
 */
async function renameSet(element) {
    var textbox = $(element);
    var value = textbox.val();

    if (!value) { return; }

    var tr = textbox.parents('tr');
    await saveValue(tr, 'name', value);
    textbox.parents('td').html(value);
}


function onRenameKeyUp(e) {
    var code = e.keyCode || e.which;

    if (code == 13) { //Enter keycode
        renameSet($(this));
    }
}


$(document).ready(function () {
    refreshSetsList();
    initialiseCheckbox();

    setCurrentFilter();

  	$('.donatelink').click(function () {
  		$('#donate').toggle();
  	});

    $("#viewSets").click(function () {
        $('#sets').addClass('allsets');
        refreshSetsList();
    });

    $("#import").click(function () {
		var importBlock = $('#importBlock');

        if (importBlock.is(':visible')) {
            importBlock.hide();
            return;
        }

        importBlock.show();
		importBlock.find('#txtImportFormJson').focus();
    });

    $("#btnImportSave").click(async function () {
  		var json = $('#txtImportFormJson').val();

  		try {
  			var importedForm = JSON.parse(json);

  			if (!importedForm.url || !importedForm.content || !importedForm.name) {
  				throw new Error("Invalid JSON format");
  			}

  			if (importedForm.url === '*'){
  				importedForm.name += '-global';
  			}

  			var key = getRandomStorageId();
            await storeOneSet(key, importedForm)
  		}
  		catch (err) {
  			alert('Got an error: ' + err.message);
  		}

  		refreshSetsList();
  		$('#importBlock').hide();
    });

    $("#clearall").click(function () {
        if ($(this).hasClass("disabled")) {
            return;
        }

        getSetsForCurrentUrl().then(async sets => {
            await removeSetOfKeys(sets.map(set => set.key));
            refreshSetsList();
        });
    });

    $("#store").click(saveFormHandler);

    var sets = $('#sets');

    sets.on("click", 'td', function (event) {
        $('div.block').hide();
    });

    sets.on("click", 'td.restore:not(.disabled)', async function (event) {
        var key = $(this).parents('tr').data('key');
        const setSettings = await getSet(key);
        const message = { action: 'fill', setSettings };
        sendMessage(message).then(window.close);
    });

    sets.on("click", 'td.submit', async function (event) {
        var td = $(this);
        var tr = td.parents('tr');

        try {

            if (td.hasClass('active')) {
                await saveValue(tr, 'autoSubmit', false);
                td.removeClass('active');
                return;
            }

            var oldQuery = await getValue(tr, 'submitQuery');
            oldQuery = oldQuery ? oldQuery : 'input[type=submit]';

            var query = prompt('Enter jquery selector for submit button to auto click', oldQuery);
            if (query) {
                await saveValue(tr, 'submitQuery', query);
                await saveValue(tr, 'autoSubmit', true);
                td.addClass('active');
            } else {
                td.removeClass('active');
            }

        } finally {
            refreshSetsList();
        }

    });

    sets.on("click", 'td.remove', async function (event) {
        var tr = $(this).parents('tr');
        var key = tr.data('key');

        await removeSetOfKeys([key]);
    	refreshSetsList();
    });

    sets.on("click", 'td.export', function (event) {
        var exportBlock = $('#exportBlock');

        if (exportBlock.is(':visible')) {
            exportBlock.hide();
            return;
        }

        var td = $(this);
        var tr = td.parents('tr');
        var key = tr.data('key');
        var formJson = localStorage.getItem(key);

        td.addClass('active');
        exportBlock.show();

        exportBlock.find('#txtFormJson').val(formJson).focus().select();
    });

    sets.on("click", 'td.hotkey', function (event) {
        var hotkeyBlock = $('#hotkeyBlock');

        if (hotkeyBlock.is(':visible')) {
            hotkeyBlock.hide();
            return;
        }

        var td = $(this);
        var tr = td.parents('tr');
        getValue(tr, 'hotkey').then((value) => {
            td.addClass('active');
            hotkeyBlock.show();
            hotkeyBlock.find('#txtHotkey').val(value).focus().select();
        });
    });

    sets.on("click", 'td.setName', function (event) {
        var td = $(this);
        if (td.find('input').length) {
            return;
        }

        var tr = td.parents('tr');
        var input = $('<input type="text" class="span1 txtSetName" />');
        input.val($(this).text());

        td.empty().append(input).find('input').focus().select();
    });

    sets.on("blur", 'input.txtSetName', function(){renameSet(this)});
    sets.on("keyup", 'input.txtSetName', onRenameKeyUp);

    $('#hotkeyBlock').on("keyup", '#txtHotkey', function (e) {
        var code = e.keyCode || e.which;
        if (code == 13) { //Enter keycode
            $('#btnHotkeySave').click();
        }
    });

    $('#btnHotkeySave').click(async function() {
        $('#hotkeyBlock').hide();
        var tr = $('#sets td.hotkey.active').parents('tr');
        var hotkey = $('#hotkeyBlock #txtHotkey').val();
        await saveValue(tr, 'hotkey', hotkey);

        refreshSetsList().then(
            () => sendMessage({ "action": 'rebind' }));
    });

    $('#btnHotkeyCancel').click(function () {
        $('#hotkeyBlock').hide();
    });

    $('#btnExportClose').click(function () {
        $('#exportBlock').hide();
    });

    $('#btnImportClose').click(function () {
        $('#importBlock').hide();
    });

    $('a.filter').click(function () {
        var link = $(this);
        var value = link.attr('id');
        $('a.filter').not(link).find('i').remove();

        localStorage.setItem('filter', value);
        link.prepend('<i class="icon-ok"></i> ');

        refreshSetsList();
    });

    sets.on("mousedown", 'tbody td', function(event) {
        $(this).addClass('clicked');
    }).on("mouseup", 'tbody td', function(event) {
        $(this).removeClass('clicked');
    });

});
