import { NEW_REQUEST_ACTION_DATA } from './constants'

let copiedElementName;
let latestRequest;

const COPIED_ELEMENT_CHECK_REMOVE_TIME_IN_MS = 1000

function getClipboardIconElement(name, value) {
    const span = document.createElement('span');
    if (name !== copiedElementName) {
        span.className = 'copy-btn'
        span.innerHTML = '<i class="fas fa-copy"></i>'
        span.addEventListener('click', copyToClipboard.bind(null, name, value))
        return span
    }

    span.className = 'check-btn'
    span.innerHTML = '<i class="fa-solid fa-check"></i>'

    return span
}

function updateRequestDataUI(latestRequest) {
    const parentDiv = document.getElementById('headers');
    parentDiv.innerHTML = ''

    latestRequest?.headers ? Object.entries(latestRequest.headers).forEach(([name, value], index) => {
        const headerItemElement = document.createElement('div');
        headerItemElement.className = 'header-item'
        headerItemElement.innerHTML = `
            <span>${index + 1}.</span>
            <span class="header-name">${name}</span>    
        `
        headerItemElement.append(getClipboardIconElement(name, value))

        parentDiv.append(headerItemElement)
    }) : ''
}

function copyToClipboard(name, textToCopy) {
    console.log(textToCopy)
    navigator.clipboard.writeText(textToCopy).then(() => {
        copiedElementName = name;
        updateRequestDataUI(latestRequest)
        setTimeout(() => {
            copiedElementName = undefined
            updateRequestDataUI(latestRequest)
        }, COPIED_ELEMENT_CHECK_REMOVE_TIME_IN_MS)
    });
}

chrome.storage.local.get([NEW_REQUEST_ACTION_DATA], (result) => {
    if (result[NEW_REQUEST_ACTION_DATA]) {
        latestRequest = result[NEW_REQUEST_ACTION_DATA]
        updateRequestDataUI(latestRequest)
    }
});
