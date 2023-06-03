
// JS documentation

/**
 * Result from exiftool
 * @typedef {Object} ExifToolResult
 * @property {string} SourceFile - the file path including the file name and folder
 * @property {string} FileName - the file name (without folder)
 * @property {string} [Description] - the description (optional), e.g. "a watercolor painting of a tree"
 * @property {string} [Keywords] - the keywords (optional)
 * @property {string} [Subject] - the subject (optional), e.g. Midjourney Job Id: 134460e9-cb4f-4446-bdfd-d1651b840c80
 * @property {string} [Author] - the author (optional), e.g. https://discord.com/@me/{platform_channel_id}/{platform_message_id}
 */

/**
 * Result from https://www.midjourney.com/api/app/recent-jobs/?amount=50&offset=0
 * @typedef {Object} JobResult
 * @property {string} id - job id
 * @property {string} enqueue_time - time job was enqueued
 * @property {string} prompt - prompt for the job
 * @property {string} full_command - full command used to generate the job (includes command flags such as --style and --seed)
 * @property {string[]} image_paths - list of image paths
 * @property {string} platform_channel_id - platform channel id
 * @property {string} platform_message_id - platform message id
 * @property {Object} event - The event associated with the job
 * @property {number} event.height - The height parameter of the event
 * @property {Array<string>} event.textPrompt - The text prompts associated with the event
 * @property {Array} event.imagePrompts - The image prompts associated with the event
 * @property {number} event.width - The width parameter of the event
 * @property {number} event.batchSize - The batch size parameter of the event
 * @property {?Array<number>} event.textPromptWeights - An array of weights corresponding to the text prompts, if any
 * @property {?string} event.seedImageURL - The URL of the seed image for the event, if any
 * @property {string} event.eventType - The type of the event, such as "imagine"
 * @property {boolean} event.test
 */







/**
 * Metadata for a job
 * @typedef {Object} JobMetadata
 */


import {existsSync} from "fs";
import path from "path";

/**
 *
 * @param {string[]} nameComponents
 * @param {string} fileExt
 * @param {number} maxLength
 * @return {string}
 */
function shrinkFileNameLength(nameComponents, fileExt, maxLength) {
    // if the combined length of the name components + file extension is greater than the max length,
    // truncate the first name component so that the combined length is less than the max length

    let retValue = `${nameComponents.join('')}`;
    if (fileExt.length > 0) {
        fileExt = `.${fileExt}`;
        retValue += `${fileExt}`;
    }

    if (retValue.length > maxLength) {
        const firstComponent = nameComponents[0];
        const remainingComponents = nameComponents.slice(1);
        const remainingLength = maxLength - remainingComponents.reduce((a, b) => a + b.length, 0) - fileExt.length;
        const truncatedFirstComponent = firstComponent.substring(0, remainingLength);
        retValue = `${truncatedFirstComponent}${remainingComponents.join('')}${fileExt}`;
    }
    ``

    return retValue;
}

function replaceOSReservedWith(filename, replacement) {
    //return filename.replace(/[/\\?%*:|"<>]/g, replacement);
    return filename.replace(/[<>:"/\\|?*\x00-\x1F~^&;${}()\[\]`#' ]/g, replacement);
}

/**
 *
 * @param {string} filePath
 * @param {string[]} fileComponents
 * @param {string} fileExt
 * @return {string} - a unique filename that does not exist in the filePath (excluding the path, e.g. "myFile.png")
 */
function generateUniqueFilename(filePath, fileComponents, fileExt) {
    // sanitize filePrefix if it contains any OS reserved characters
    fileComponents = fileComponents.map(f => replaceOSReservedWith(f, '-'));

    const MAX_FILE_NAME_LENGTH = 225; // shrank from 240 to be safe

    // generate a unique filename, if file exists locally, append a number to the end
    let fileName = shrinkFileNameLength(fileComponents, fileExt, MAX_FILE_NAME_LENGTH);
    let fileNameIndex = 1;
    while (existsSync(path.join(filePath, fileName))) {
        fileName = shrinkFileNameLength([...fileComponents, `${fileNameIndex}`], fileExt, MAX_FILE_NAME_LENGTH);
        fileNameIndex++;
    }
    return fileName;
}


function createHeaderBlock(session_token) {
    const headers = {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "sec-gpc": "1",
        "cookie": `__Secure-next-auth.session-token=${session_token}`,
        "Referer": "https://www.midjourney.com/app/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    };
    return headers;
}

export {
    generateUniqueFilename,
    createHeaderBlock
}