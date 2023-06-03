import terminalKitPackage from 'terminal-kit';
import {safeRunAsync, safeRunSync} from "./utils.js";
const {terminal: term} = terminalKitPackage;

function printMenuMessage(msg) {
    // Save the current cursor position
    term.saveCursor();

    // Move to top right corner of terminal
    term.moveTo(term.width, 1);

    // Clear line to make sure message is visible
    term.eraseLine();

    // Move back a few steps to print the message
    term.left(msg.length);

    // Print the message
    term.bold(msg);

    // Restore cursor to its original position
    term.restoreCursor();
}



function debugLog(...args) {
    if (process.env.DEBUG) {
        console.log(...args);
    }
}

function printMaxWidth(text, maxWidth) {
    // get the maximum width of the terminal

    // if text is longer than max width, cut out the middle section and replace with ellipsis
    if (text.length > maxWidth) {
        const half = Math.floor(maxWidth / 2);
        const firstHalf = text.substring(0, half - 2);
        const secondHalf = text.substring(text.length - half + 2);
        text = `${firstHalf}...${secondHalf}`;
    }

    print(text);
}

function print(text) {
    term(`${text}\n`);
}

function printError(text) {
    term.bold.red.error(`${text}\n`);
}

function printBold(text) {
    term.bold(`${text}\n`);
}


function startPersistentMessage(msg) {
    const intervalId = setInterval(() => printMenuMessage(msg), 500);
    return intervalId;
}

function stopPersistentMessage(intervalId) {
    safeRunSync(() => clearInterval(intervalId));
}


export {
    printMenuMessage,
    startPersistentMessage,
    stopPersistentMessage,
    print,
    printError,
    printBold,
    debugLog,
    printMaxWidth,
}