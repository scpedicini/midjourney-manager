import terminalKitPackage from 'terminal-kit';
import {safeRunAsync, safeRunSync} from "./utils.js";
const {terminal: term} = terminalKitPackage;

function printMessage(msg) {
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

function startPersistentMessage(msg) {
    const intervalId = setInterval(() => printMessage(msg), 500);
    return intervalId;
}

function stopPersistentMessage(intervalId) {
    safeRunSync(() => clearInterval(intervalId));
}


export {
    printMessage,
    startPersistentMessage,
    stopPersistentMessage
}