import fetch from 'node-fetch';
import {readFileSync, existsSync, unlinkSync} from "fs";
import {writeFile} from 'fs/promises'
import {fileTypeFromFile} from 'file-type';
import path from "path";
import { execSync } from 'child_process';

/**
 * Procedure for using mass midjournal downloader:
 * 1. Create a folder in your local machine to store the downloaded files.
 * 2. Navigate to https://www.midjourney.com/app and login.
 * 3. Monitor network requests
 * 4. Copy the cookie from https://www.midjourney.com/api/app/recent-jobs/?amount=50...
 * 5. Paste the cookie into MIDJOURNEY_COOKIE environment variable.
 * 6. Run the script.
 *
 * You will also need to have both ImageMagick and exiftool installed on your machine.
 */

// use dotenv to load environment variables from .env file
import dotenv from 'dotenv';
import {fetchBinary, throwIfUndefinedOrNull} from "./utils.js";
import {createHeaderBlock, generateUniqueFilename} from "./mj-helper.js";
dotenv.config();

// verify we have process env vars for MIDJOURNEY_COOKIE and USER_ID
if (!process.env['MIDJOURNEY_COOKIE']) {
    console.log('MIDJOURNEY_COOKIE environment variable not set');
    process.exit(1);
}

if (!process.env['USER_ID']) {
    console.log('USER_ID environment variable not set');
    process.exit(1);
}


const outputDir = process.argv[2] || process.cwd();
const hashFile = path.join(outputDir, 'downloaded.json');
const sessionToken = process.env['MIDJOURNEY_COOKIE'];

const DOWNLOAD_MODE = true;



async function isFileAnImage(file) {
    const buffer = await fileTypeFromFile(file);
    return buffer?.mime?.startsWith('image/');
}

/**
 * Gets all exif data from all a list of files
 * @param folder
 * @return {ExifToolResult[]}
 */
function getExifToolJsonDataFromAllPngsInFolder(folder) {
    // escape folder name in case it contains spaces
    const escapedFolder = folder.replace(/ /g, '\\ ');

    // use standard fs to create a tmp file to store the exiftool output
    const tmpFile = path.join(folder, 'exiftool.json');
    const cmd_line = `exiftool -j ${escapedFolder}/*.png > "${tmpFile}"`;
    execSync(cmd_line, { encoding: 'utf8' });

    // read the tmp file and parse the json
    const json = readFileSync(tmpFile, 'utf8');
    const exifData = JSON.parse(json);

    // delete the tmp file
    unlinkSync(tmpFile);

    return exifData;
}


function writeImageIPTCDetails(localFile, fieldName, fieldValue) {

    // sanitize fieldValue since it is part of a bash command
    fieldValue = fieldValue.replace(/"/g, '\\"');

    const cmd_line = `exiftool -${fieldName}="${fieldValue}" -overwrite_original "${localFile}"`;
    const result = execSync(cmd_line, { encoding: 'utf8' });
    return result;
}

function mergeCollage(images, outputFile) {
    const program = 'magick';
    execSync(`${program} montage ${images.map(i => `"${i}"`).join(' ')} -geometry +0+0 "${outputFile}"`, { encoding: 'utf8' });
    return outputFile;
}

async function downloadMidjourneyAllImages() {
    let setDownloaded;
    if(existsSync(hashFile)) {
        setDownloaded = new Set(JSON.parse(readFileSync(hashFile, 'utf8')));
    } else {
        setDownloaded = new Set();
    }

    // const exifImagesData = getExifToolJsonDataFromAllPngsInFolder(outputDir);

    let discordLinksNotFound = 0;
    // last pageNumber = 1834
    let totalDownloads = 0;
    let totalImages = 0;
    for (let i = 0; i <= 60; i++) {

        const userId = process.env.USER_ID;

        // each of these URLs returns at most 50 jobs each consisting of 50 images (2500 images)
        // if you've generated more than 5000 images, the oldestUrl and newestUrl will not
        // overlap and those images will not be downloaded (this is a current limitation of the mj API)
        const jsonUrlTemplateNewest = i === 0 ? `https://www.midjourney.com/api/app/recent-jobs/?amount=50&jobType=null&orderBy=new&user_id_ranked_score=null&jobStatus=completed&userId=${userId}&dedupe=true&refreshApi=0` :
            `https://www.midjourney.com/api/app/recent-jobs/?amount=50&jobType=null&orderBy=new&user_id_ranked_score=null&jobStatus=completed&userId=${userId}&dedupe=true&refreshApi=0&page=${i}`;

        const jsonUrlTemplateOldest = i === 0 ? `https://www.midjourney.com/api/app/recent-jobs/?amount=50&jobType=null&orderBy=oldest&user_id_ranked_score=null&jobStatus=completed&userId=${userId}&dedupe=true&refreshApi=0` :
            `https://www.midjourney.com/api/app/recent-jobs/?amount=50&jobType=null&orderBy=oldest&user_id_ranked_score=null&jobStatus=completed&userId=${userId}&dedupe=true&refreshApi=0&page=${i}`;

        const jsonUrlTemplate = jsonUrlTemplateNewest;

        const response = await fetch(jsonUrlTemplate, { headers: createHeaderBlock(sessionToken) });
        if (response.ok) {
            /** @type {JobResult[]} */
            const results = await response.json();

            if((results.length === 0) || (results.length === 1 && results[0]?.msg?.toLowerCase()?.includes('no jobs found'))) {
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
                const local_files = [];

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

                        const dateCreated = Date.parse(result.enqueue_time);
                        const dateFilePrefix = !isNaN(dateCreated) ? `${Math.floor(dateCreated / 1000)}_` : '';

                        let fileExt = 'png';
                        // we are going to have to download each separately and combine them what a pain
                        for(const image_path of image_paths) {
                            const downloadUrl = new URL(image_path);
                            fileExt = downloadUrl.pathname.split('.').pop();
                            let localFile = generateUniqueFilename(outputDir, [`${dateFilePrefix}${prompt_basic}`], fileExt);
                            localFile = path.join(outputDir, localFile);
                            await fetchBinary(downloadUrl, localFile);
                            local_files.push(localFile);
                        }

                        let finalFile = local_files[0];
                        if(is_collage) {
                            finalFile = generateUniqueFilename(outputDir, [`${dateFilePrefix}${prompt_basic}`, '_collage'], fileExt);
                            finalFile = path.join(outputDir, finalFile);
                            finalFile = mergeCollage(local_files, finalFile);
                        }

                        if (await isFileAnImage(finalFile)) {
                            console.log(`Downloaded ${finalFile}`);

                            // write IPTC keywords to image
                            writeImageIPTCDetails(finalFile, "Description", prompt_detail);
                            // Subject is actually a list of keywords (shows up in Mac Finder file info, PS, etc)
                            writeImageIPTCDetails(finalFile, "Subject", `Midjourney Job Id: ${id}`);
                            // Write a Date Created field according to IPTC spec, which is YYYY:MM:DD HH:MM:SS

                            if(typeof result.platform_channel_id === 'string' && result.platform_channel_id.length > 0 &&
                                typeof result.platform_message_id === 'string' && result.platform_message_id.length > 0) {
                                // the platform_channel_id corresponds to the channel (e.g. #general, #experimental, etc), and the platform_message_id corresponds to the message id
                                const discord_url = `https://discord.com/channels/@me/${result.platform_channel_id}/${result.platform_message_id}`;
                                writeImageIPTCDetails(finalFile, "Author", discord_url);
                            }

                            if(!isNaN(dateCreated)) {
                                writeImageIPTCDetails(finalFile, "IPTC:DateCreated", new Date(dateCreated).toISOString()
                                    .replace(/T/, ' ')
                                    .replace(/\..+/, '')
                                    .replace(/-/g, ':'));
                            }

                            if(is_collage) {
                                // delete all the files from local_files
                                local_files.forEach(f => unlinkSync(f));
                            }

                            setDownloaded.add(id);
                            totalDownloads++;
                            await sleep(250);

                        } else {
                            console.error(`${finalFile} is not an image`);
                        }
                    } else {
                        console.log(`Already fetched midjourney image for ${id} and ${prompt_basic} ${image_paths.join(', ')}`);
                    }
                } catch (e) {
                    const json = JSON.stringify(Array.from(setDownloaded));
                    await writeFile(hashFile, json, 'utf8');
                    console.log(`Error downloading id of ${id} - ${e.message}`);

                    // clean up old files since we failed
                    local_files.forEach(f => unlinkSync(f));
                }
            }
            console.log(`Saving midjourney ids down to disk - total downloads: ${totalDownloads}, total images: ${totalImages}`);
            const json = JSON.stringify(Array.from(setDownloaded));
            await writeFile(hashFile, json, 'utf8');
        }
    }

    console.log(`Downloaded ${setDownloaded.size} images, total images: ${totalImages}`);

    // serialize setDownloaded and write to file in working directory
    const json = JSON.stringify(Array.from(setDownloaded));
    await writeFile(hashFile, json, 'utf8');
}



(async () => {
    await downloadMidjourneyAllImages();
    console.log("Finished");
})();