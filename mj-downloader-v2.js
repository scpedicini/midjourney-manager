import fetch from 'node-fetch';
import {readFileSync, existsSync, unlinkSync} from "fs";
import {writeFile} from 'fs/promises'
import path from "path";
import dotenv from 'dotenv';
import {
    createGridUsingBitBlt,
    createPngFromBuffer,
    fetchAsBuffer,
    sleep,
    throwIfUndefinedOrNull,
    writePngToFile
} from "./utils.js";
import { exiftool }  from "exiftool-vendored";
import {PNG} from "pngjs";
import terminalKitPackage from 'terminal-kit';
const { terminal: term  } = terminalKitPackage;
/**
 * Procedure for using mass midjournal downloader:
 * 1. Create a folder in your local machine to store the downloaded files.
 * 2. Navigate to https://www.midjourney.com/app and login.
 * 3. Monitor network requests
 * 4. Copy the cookie from https://www.midjourney.com/api/app/recent-jobs/?amount=50...
 * 5. Paste the cookie into MIDJOURNEY_COOKIE environment variable.
 * 6. Run the script.
 *
 * Exiftool should get installed as part of the vendored NPM package.
 */

// use dotenv to load environment variables from .env file
dotenv.config();

// verify we have process env vars for MIDJOURNEY_COOKIE and USER_ID
// if (!process.env['MIDJOURNEY_COOKIE']) {
//     console.log('MIDJOURNEY_COOKIE environment variable not set');
//     process.exit(1);
// }

// if (!process.env['USER_ID']) {
//     console.log('USER_ID environment variable not set');
//     process.exit(1);
// }

const workingDir = process.cwd();
const configFile = path.join(workingDir, 'config.json');
const configData = { };
let hashFile = '';
const DOWNLOAD_MODE = true;


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
 * @property {string} full_command - full command used to generate the job
 * @property {string[]} image_paths - list of image paths
 * @property {string} platform_channel_id - platform channel id
 * @property {string} platform_message_id - platform message id
 */


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


/**
 *
 * @param {string} filePath
 * @param {string[]} fileComponents
 * @param {string} fileExt
 * @return {string}
 */
function generateUniqueFilename(filePath, fileComponents, fileExt) {
    // sanitize filePrefix if it contains any OS reserved characters
    fileComponents = fileComponents.map(f => f.replace(/[/\\?%*:|"<>]/g, '-'));

    const MAX_FILE_NAME_LENGTH = 240;

    // generate a unique filename, if file exists locally, append a number to the end
    let fileName = shrinkFileNameLength(fileComponents, fileExt, MAX_FILE_NAME_LENGTH);
    let fileNameIndex = 1;
    while (existsSync(path.join(filePath, fileName))) {
        fileName = shrinkFileNameLength([...fileComponents, `${fileNameIndex}`], fileExt, MAX_FILE_NAME_LENGTH);
        fileNameIndex++;
    }
    return fileName;
}


function createHeaderBlock() {
    const headers = {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "sec-gpc": "1",
        "cookie": configData.cookie,
        "Referer": "https://www.midjourney.com/app/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    };
    return headers;
}

async function verifyConfig() {
    let prevConfigData = existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : {
        cookie: '',
        userId: '',
        outputLocation: process.argv[2] || process.cwd()
    };

    term(`Current configuration, press enter to keep current value\n`);
    term(`\nUser Id: (Currently: ${prevConfigData.userId})\n`);
    const newUserId = await term.inputField().promise
    if (newUserId.length > 0) {
        configData.userId = newUserId;
    } else {
        configData.userId = prevConfigData.userId;
    }

    term(`\nCookie: (Currently: ${prevConfigData.cookie})\n`);
    const newCookie = await term.inputField().promise
    if (newCookie.length > 0) {
        configData.cookie = newCookie;
    } else {
        configData.cookie = prevConfigData.cookie;
    }

    term(`\nOutput Location: (Currently: ${prevConfigData.outputLocation})\n`);
    const newOutputLocation = await term.inputField().promise
    if (newOutputLocation.length > 0) {
        configData.outputLocation = newOutputLocation;
    } else {
        configData.outputLocation = prevConfigData.outputLocation;
    }

    hashFile = path.join(configData.outputLocation, 'downloaded.json');

    await updateConfigFile(configData.cookie, configData.userId, configData.outputLocation);
}

async function updateConfigFile(cookieData, userId, outputLocation) {
    const configFile = path.join(workingDir, 'config.json');
    const configData = {
        cookie: cookieData,
        userId: userId,
        outputLocation: outputLocation
    };
    await writeFile(configFile, JSON.stringify(configData, null, 4), 'utf8');
}

async function downloadMidjourneyAllImages() {

    await verifyConfig();

    // verify that exiftool is installed
    const exifVersion = await exiftool.version();
    if (isNaN(parseFloat(exifVersion))) {
        console.log('exiftool not found');
        process.exit(1);
    }

    let setDownloaded;
    if (existsSync(hashFile)) {
        setDownloaded = new Set(JSON.parse(readFileSync(hashFile, 'utf8')));
    } else {
        setDownloaded = new Set();
    }

    // const exifImagesData = getExifToolJsonDataFromAllPngsInFolder(outputDir);


    // last pageNumber = 1834
    let totalDownloads = 0;
    let totalImages = 0;
    for (let i = 0; i <= 60; i++) {


        // each of these URLs returns at most 50 jobs each consisting of 50 images (2500 images)
        // if you've generated more than 5000 images, the oldestUrl and newestUrl will not
        // overlap and those images will not be downloaded (this is a current limitation of the mj API)
        const jsonUrlTemplateNewest = i === 0 ? `https://www.midjourney.com/api/app/recent-jobs/?amount=50&jobType=null&orderBy=new&user_id_ranked_score=null&jobStatus=completed&userId=${configData.userId}&dedupe=true&refreshApi=0` :
            `https://www.midjourney.com/api/app/recent-jobs/?amount=50&jobType=null&orderBy=new&user_id_ranked_score=null&jobStatus=completed&userId=${configData.userId}&dedupe=true&refreshApi=0&page=${i}`;

        const jsonUrlTemplateOldest = i === 0 ? `https://www.midjourney.com/api/app/recent-jobs/?amount=50&jobType=null&orderBy=oldest&user_id_ranked_score=null&jobStatus=completed&userId=${configData.userId}&dedupe=true&refreshApi=0` :
            `https://www.midjourney.com/api/app/recent-jobs/?amount=50&jobType=null&orderBy=oldest&user_id_ranked_score=null&jobStatus=completed&userId=${configData.userId}&dedupe=true&refreshApi=0&page=${i}`;

        const jsonUrlTemplate = jsonUrlTemplateNewest;

        const response = await fetch(jsonUrlTemplate, {headers: createHeaderBlock()});
        if (response.ok) {
            /** @type {JobResult[]} */
            const results = await response.json();

            if ((results.length === 0) || (results.length === 1 && results[0]?.msg?.toLowerCase()?.includes('no jobs found'))) {
                console.log(`No results for page ${i}`);
                continue;
            }

            for (const result of results) {
                totalImages++;
                const id = result?.id; // the job id, e.g. 16ece578-e17e-4b0d-a915-8a8c7b567db1
                // an array of images from the MJ CDN, e.g. ["https://cdn.midjourney.com/26ece478-e17e-4b0d-a915-8a8c7b567db1/0_0.png"]
                const image_paths = result?.image_paths;
                const prompt_basic = result.prompt?.substring(0, 225) ?? "empty prompt";
                const prompt_detail = result?.full_command;
                const local_buffers = [];

                try {


                    // temporary fix to back-fill missing discord links on old images
                    /*if(typeof result.platform_channel_id === 'string' && result.platform_channel_id.length > 0 &&
                        typeof result.platform_message_id === 'string' && result.platform_message_id.length > 0) {
                        const discord_url = `https://discord.com/channels/@me/${result.platform_channel_id}/${result.platform_message_id}`;

                        const exifImageData = exifImagesData.find(e => e.Subject === `Midjourney Job Id: ${id}`);
                        if(exifImageData && !exifImageData.Author) {
                            const localFile = exifImageData.SourceFile;
                            // embed this link as an exif comment in the image
                            console.log(`Embedding discord link in ${localFile}`);
                            writeImageIPTCDetails(localFile, "Author", discord_url);
                        }

                    } else {
                        discordLinksNotFound++;
                        console.log(`No Discord URL, number of discord links not found: ${discordLinksNotFound}`);
                    }*/

                    if (!DOWNLOAD_MODE)
                        continue;

                    if (!setDownloaded.has(id)) {

                        throwIfUndefinedOrNull(id, image_paths, prompt_basic, prompt_detail);
                        const is_collage = image_paths.length > 1;

                        const isoTimeCreated = result.enqueue_time;
                        const epochTimeCreated = Date.parse(result.enqueue_time);
                        const dateFilePrefix = !isNaN(epochTimeCreated) ? `${Math.floor(epochTimeCreated / 1000)}_` : '';

                        // we are going to have to download each separately and combine them what a pain
                        for (const image_path of image_paths) {
                            const downloadUrl = new URL(image_path);
                            // TODO Convert to promise.all
                            const buffer = await fetchAsBuffer(downloadUrl);
                            local_buffers.push(buffer);
                        }

                        let localFileName = generateUniqueFilename(outputDir, [`${dateFilePrefix}${prompt_basic}`], 'png');

                        let pngObj;
                        if (is_collage) {
                            localFileName = generateUniqueFilename(outputDir, [`${dateFilePrefix}${prompt_basic}`, '_collage'], 'png');
                            pngObj = await createGridUsingBitBlt(local_buffers);
                        } else {
                            pngObj = await createPngFromBuffer(local_buffers[0]);
                        }

                        localFileName = path.join(outputDir, localFileName);

                        console.log(`Downloaded prompt ${result.enqueue_time}: ${prompt_basic}`);
                        const tags = { }

                        // write IPTC keywords to image
                        // writeIPTCAsTextChunkToPng(pngObj, "Description", prompt_detail);
                        tags['Description'] = prompt_detail;

                        // Subject is actually a list of keywords (shows up in Mac Finder file info, PS, etc)
                        // writeIPTCAsTextChunkToPng(pngObj, "Subject", `Midjourney Job Id: ${id}`);
                        tags['Subject'] = `Midjourney Job Id: ${id}`;
                        // Write a Date Created field according to IPTC spec, which is YYYY:MM:DD HH:MM:SS

                        if (typeof result.platform_channel_id === 'string' && result.platform_channel_id.length > 0 &&
                            typeof result.platform_message_id === 'string' && result.platform_message_id.length > 0) {
                            // the platform_channel_id corresponds to the channel (e.g. #general, #experimental, etc), and the platform_message_id corresponds to the message id
                            const discord_url = `https://discord.com/channels/@me/${result.platform_channel_id}/${result.platform_message_id}`;
                            // writeIPTCAsTextChunkToPng(pngObj, "Author", discord_url);
                            tags['Author'] = discord_url;
                        }

                        if (!isNaN(epochTimeCreated)) {
                            // writeIPTCAsTextChunkToPng(pngObj, "IPTC:DateCreated", new Date(epochTimeCreated).toISOString()
                            //     .replace(/T/, ' ')
                            //     .replace(/\..+/, '')
                            //     .replace(/-/g, ':'));
                            tags['AllDates'] = isoTimeCreated;
                        }

                        const oldWidth = pngObj.width;
                        const oldHeight = pngObj.height;
                        await writePngToFile(pngObj, localFileName);

                        // write full set of tags to file
                        await exiftool.write(localFileName, tags, ['-overwrite_original']);

                        // pull file to a Buffer and pngJS (will throw if not a png)
                        const imageBuffer = readFileSync(localFileName);
                        const pngTester = PNG.sync.read(imageBuffer);

                        // check that the image is the same size as the original
                        if (pngTester.width !== oldWidth || pngTester.height !== oldHeight) {
                            unlinkSync(localFileName);
                            throw new Error(`EXIF tag write resulted in corruption, skipping downloading of job id ${id} with prompt: ${prompt_basic}`);
                        }

                        setDownloaded.add(id);
                        totalDownloads++;
                        await sleep(250);
                    } else {
                        console.log(`Already fetched midjourney image for ${id} and ${prompt_basic} ${image_paths.join(', ')}`);
                    }
                } catch (e) {
                    const json = JSON.stringify(Array.from(setDownloaded));
                    await writeFile(hashFile, json, 'utf8');
                    console.log(`Error downloading id ${id} - ${prompt_basic} ${e.message}`);
                }
            }
            console.log(`Saving midjourney ids down to disk - total downloads: ${totalDownloads}, total images: ${totalImages}`);
            const json = JSON.stringify(Array.from(setDownloaded));
            await writeFile(hashFile, json, 'utf8');
        } else if(response.status === 403) {
            // cookie is likely invalid or expired
            term.error(`Forbidden error likely due to an invalid or expired cookie.`);
            await verifyConfig();
            i--;
        }
    }

    console.log(`Downloaded ${setDownloaded.size} images, total images: ${totalImages}`);

    // serialize setDownloaded and write to file in working directory
    const json = JSON.stringify(Array.from(setDownloaded));
    await writeFile(hashFile, json, 'utf8');
}


(async () => {
    try {

        await downloadMidjourneyAllImages();
        console.log("Midjourney Batch downloading complete");
    } catch (e) {
        console.error(e);
    } finally {

    }
})();