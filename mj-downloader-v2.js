import fetch from 'node-fetch';
import {readFileSync, existsSync, unlinkSync} from "fs";
import {writeFile} from 'fs/promises'
import path from "path";
import dotenv, {config} from 'dotenv';
import {
    createGridUsingBitBlt,
    createPngFromBuffer,
    fetchAsBuffer, safeRunAsync,
    sleep,
    throwIfUndefinedOrNull,
    writePngToFile,
} from "./utils.js";
import {exiftool} from "exiftool-vendored";
import {PNG} from "pngjs";
import terminalKitPackage from 'terminal-kit';
import {createHeaderBlock, generateUniqueFilename} from "./mj-helper.js";
import {
    print,
    printBold,
    printError,
    printMaxWidth,
    startPersistentMessage,
    stopPersistentMessage
} from "./terminal-helper.js";

const {terminal: term} = terminalKitPackage;
/**
 * Procedure for using mass midjournal downloader:
 * 1. Create a folder in your local machine to store the downloaded files.
 * 2. Navigate to https://www.midjourney.com/app and login.
 * 3. Open the Chrome/Firefox Developer Console (F12)
 * 4. Copy the __Secure-next-auth.session-token cookie from https://www.midjourney.com/app
 * 6. Run the script.
 *
 * Exiftool is included as part of the vendored NPM package.
 */

// use dotenv to load environment variables from .env file
dotenv.config();

const workingDir = process.cwd();
const configFile = path.join(workingDir, 'config.json');
const configData = {};
let hashFile = '';
const DOWNLOAD_MODE = true;

const STATE_IDLE = 'idle';
const STATE_DOWNLOADING = 'downloading';
const STATE_USER_CONFIG = 'user-config';
let EXITING = false;

let currentState = STATE_IDLE;

const keyHandlerFunction = function (key, matches, data) {

    if ((key === 'ESCAPE' || (process.env.DEBUG && key === 'Q'))) {
        term.bold.blue.blink('\n\n *Please wait - downloader is exiting...\n')
        EXITING = true;
        cleanup();
        if(currentState === STATE_USER_CONFIG) {
            process.exit(0);
        }
    }
}

// term.grabInput({mouse: 'button'}); // This starts listening for input events.
term.on('key', keyHandlerFunction);

function cleanup() {
    // term.grabInput(false);
    term.off('key', keyHandlerFunction);
}

function getPreviousConfig() {
    let stockConfigData = {
        sessionToken: '',
        userId: '',
        outputLocation: process.argv[2] || process.cwd(),
        createSidecarJson: false
    }

    try {
        if (existsSync(configFile)) {
            const prevConfigData = JSON.parse(readFileSync(configFile, 'utf8'));
            stockConfigData = {
                ...stockConfigData,
                ...prevConfigData
            }
        }
    } catch (e) {

    }

    return stockConfigData;
}

async function verifyConfig() {
    const prevConfigData = getPreviousConfig();

    printBold(`Setup configuration (press enter to skip and keep current value)`);
    printBold(`For details on how to setup the downloader, please visit https://github.com/scpedicini/midjourney-manager`);
    print(`\nUser Id: (Currently: ${prevConfigData.userId})`);
    const newUserId = await term.inputField().promise
    if (newUserId.length > 0) {
        configData.userId = newUserId;
    } else {
        configData.userId = prevConfigData.userId;
    }

    print(`\n__Secure-next-auth.session-token Cookie from https://midjourney.com/app (Currently: ${prevConfigData.sessionToken})`);
    const newSessionToken = await term.inputField().promise
    if (newSessionToken.length > 0) {
        configData.sessionToken = newSessionToken;
    } else {
        configData.sessionToken = prevConfigData.sessionToken;
    }

    print(`\nOutput Location: (Currently: ${prevConfigData.outputLocation})`);
    const newOutputLocation = await term.inputField().promise
    if (newOutputLocation.length > 0) {
        configData.outputLocation = newOutputLocation;
    } else {
        configData.outputLocation = prevConfigData.outputLocation;
    }

    print(`\nWould you like to create sidecar JSON files for every image downloaded? (y/n) (Currently: ${prevConfigData.createSidecarJson})`);
    const answer = await term.yesOrNo({yes: ['y', 'Y'], no: ['n', 'N']}).promise
    configData.createSidecarJson = answer;

    hashFile = path.join(configData.outputLocation, 'downloaded.json');

    await updateConfigFile(configData.sessionToken, configData.userId, configData.outputLocation, configData.createSidecarJson);
}

async function updateConfigFile(sessionToken, userId, outputLocation, createSidecarJson) {
    const configFile = path.join(workingDir, 'config.json');
    const configData = {
        sessionToken: sessionToken,
        userId: userId,
        outputLocation: outputLocation,
        createSidecarJson: createSidecarJson
    };
    await writeFile(configFile, JSON.stringify(configData, null, 4), 'utf8');
}

async function downloadMidjourneyAllImages() {


    // verify that exiftool is installed
    const exifVersion = await exiftool.version();
    if (isNaN(parseFloat(exifVersion))) {
        print('exiftool not found');
        process.exit(1);
    }

    let setDownloaded;
    try {
        if (existsSync(hashFile)) {
            setDownloaded = new Set(JSON.parse(readFileSync(hashFile, 'utf8')));
        } else {
            setDownloaded = new Set();
        }
    } catch (e) {
        setDownloaded = new Set();
    }

    // const exifImagesData = getExifToolJsonDataFromAllPngsInFolder(outputDir);


    // last pageNumber = 1834
    let totalDownloads = 0;
    for (let i = 0; i <= 60; i++) {
        if (EXITING) {
            break;
        }


        // each of these URLs returns at most 50 jobs each consisting of 50 images (2500 images)
        // if you've generated more than 5000 images, the oldestUrl and newestUrl will not
        // overlap and those images will not be downloaded (this is a current limitation of the mj API)
        const jsonUrlTemplateNewest = i === 0 ? `https://www.midjourney.com/api/app/recent-jobs/?amount=50&jobType=null&orderBy=new&user_id_ranked_score=null&jobStatus=completed&userId=${configData.userId}&dedupe=true&refreshApi=0` :
            `https://www.midjourney.com/api/app/recent-jobs/?amount=50&jobType=null&orderBy=new&user_id_ranked_score=null&jobStatus=completed&userId=${configData.userId}&dedupe=true&refreshApi=0&page=${i}`;

        const jsonUrlTemplateOldest = i === 0 ? `https://www.midjourney.com/api/app/recent-jobs/?amount=50&jobType=null&orderBy=oldest&user_id_ranked_score=null&jobStatus=completed&userId=${configData.userId}&dedupe=true&refreshApi=0` :
            `https://www.midjourney.com/api/app/recent-jobs/?amount=50&jobType=null&orderBy=oldest&user_id_ranked_score=null&jobStatus=completed&userId=${configData.userId}&dedupe=true&refreshApi=0&page=${i}`;

        const jsonUrlTemplate = jsonUrlTemplateNewest;
        let spinner;

        const response = await fetch(jsonUrlTemplate, {headers: createHeaderBlock(configData.sessionToken)});
        if (response.ok) {
            /** @type {JobResult[]} */
            const results = await response.json();

            if ((results.length === 0) || (results.length === 1 && results[0]?.msg?.toLowerCase()?.includes('no jobs found'))) {
                print(`No results for page ${i}`);
                continue;
            }

            for (const result of results) {
                if (EXITING) {
                    break;
                }

                const id = result?.id; // the job id, e.g. 16ece578-e17e-4b0d-a915-8a8c7b567db1
                // an array of images from the MJ CDN, e.g. ["https://cdn.midjourney.com/26ece478-e17e-4b0d-a915-8a8c7b567db1/0_0.png"]
                const image_paths = result?.image_paths;
                // Basic prompt truncated to 225 characters
                const prompt_basic = (result.event?.textPrompt?.join(' ') ||
                    result.prompt || "empty prompt").substring(0, 225);
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
                            print(`Embedding discord link in ${localFile}`);
                            writeImageIPTCDetails(localFile, "Author", discord_url);
                        }

                    } else {
                        discordLinksNotFound++;
                        print(`No Discord URL, number of discord links not found: ${discordLinksNotFound}`);
                    }*/

                    if (!DOWNLOAD_MODE)
                        continue;

                    if (!setDownloaded.has(id)) {

                        throwIfUndefinedOrNull(id, image_paths, prompt_basic, prompt_detail);
                        // save term position of spinner so we can overwrite it later

                        const position = await term.getCursorLocation();
                        spinner = await term.spinner('lineSpinner');
                        printMaxWidth(`  Downloading prompt ${new Date(result.enqueue_time.endsWith('Z') ? result.enqueue_time : `${result.enqueue_time}Z`).toLocaleString()}: ${prompt_basic}`, term.width);

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

                        let localFileName;
                        let sidecarFileName;
                        let pngObj;
                        if (is_collage) {
                            localFileName = generateUniqueFilename(configData.outputLocation, [`${dateFilePrefix}${prompt_basic}`, '_collage'], 'png');
                            sidecarFileName = generateUniqueFilename(configData.outputLocation, [localFileName], 'json');
                            pngObj = await createGridUsingBitBlt(local_buffers);
                        } else {
                            localFileName = generateUniqueFilename(configData.outputLocation, [`${dateFilePrefix}${prompt_basic}`], 'png');
                            sidecarFileName = generateUniqueFilename(configData.outputLocation, [localFileName], 'json');
                            pngObj = await createPngFromBuffer(local_buffers[0]);
                        }

                        localFileName = path.join(configData.outputLocation, localFileName);
                        sidecarFileName = path.join(configData.outputLocation, sidecarFileName);

                        const tags = {}

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

                        // write the sidecar file
                        if (configData.createSidecarJson === true) {
                            await writeFile(sidecarFileName, JSON.stringify(result, null, 4), 'utf8');
                        }

                        // check that the image is the same size as the original
                        if (pngTester.width !== oldWidth || pngTester.height !== oldHeight) {
                            unlinkSync(localFileName);
                            unlinkSync(sidecarFileName);
                            throw new Error(`EXIF tag write resulted in corruption, skipping downloading of job id ${id} with prompt: ${prompt_basic}`);
                        }

                        await safeRunAsync(async () => await spinner.animate(false));
                        // write a checkbox emoji in the terminal at the saved position
                        term.saveCursor();
                        term.moveTo(position.x, position.y - (position.y === term.height ? 1 : 0));
                        term('✅');
                        term.restoreCursor();

                        setDownloaded.add(id);
                        totalDownloads++;
                        await sleep(100);
                    } else {
                        print(`⏭️  Already fetched midjourney image for ${id} and ${prompt_basic} ${image_paths.join(', ')}`);
                    }
                } catch (e) {
                    const json = JSON.stringify(Array.from(setDownloaded));
                    await writeFile(hashFile, json, 'utf8');
                    printError(`❌  Error downloading id ${id} - ${prompt_basic} ${e.message}`);
                } finally {
                    // try {
                    //     await spinner.animate(false);
                    // } catch (e) {
                    // }

                }
            }
            printBold(`Saving midjourney IDs down to disk - total successful downloads: ${totalDownloads}`);
            const json = JSON.stringify(Array.from(setDownloaded));
            await writeFile(hashFile, json, 'utf8');
        } else if (response.status === 403) {
            // cookie is likely invalid or expired
            printError(`🚫  Forbidden error likely due to an invalid or expired session token cookie.`);
            currentState = STATE_USER_CONFIG;
            await verifyConfig();
            currentState = STATE_DOWNLOADING;
            i--;
        }
    }

    printBold(`Downloaded during this run: ${totalDownloads}, number of images processed over lifetime: ${setDownloaded.size}`);

    // serialize setDownloaded and write to file in working directory
    const json = JSON.stringify(Array.from(setDownloaded));
    await writeFile(hashFile, json, 'utf8');
}


(async () => {
    let persistentMessageId = 0;

    try {
        const packageJsonData = JSON.parse(readFileSync('./package.json', 'utf8'));

        let headerText = `Welcome to Midjourney Manager v${packageJsonData.version} `;

        // Clear the terminal
        term.clear();

        // Move the cursor to the center of the terminal, horizontally
        term.moveTo(Math.round(term.width / 2 - headerText.length / 2), 1);

        // Print the header
        term.bold.underline.green(headerText + '\n');

        currentState = STATE_USER_CONFIG;
        await verifyConfig();

        persistentMessageId = startPersistentMessage("Press Escape to Quit");

        // Reset the terminal styles
        // term.reset();
        currentState = STATE_DOWNLOADING;
        await downloadMidjourneyAllImages();
        printBold("Midjourney downloading complete");
    } catch (e) {
        printError(`Unidentified error: ${e.message}`);
        printError(`Consider filing a bug report at https://github.com/scpedicini/midjourney-manager/issues`);
    } finally {
        stopPersistentMessage(persistentMessageId);
        process.exit(0);
    }
})();