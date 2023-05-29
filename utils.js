import {PNG} from "pngjs";
import fetch from "node-fetch";
import fs, {createWriteStream} from "fs";
import {pipeline} from "stream/promises";
import {fileTypeFromBuffer} from "file-type";
import terminalKitPackage from 'terminal-kit';
const { terminal: term  } = terminalKitPackage;
function debugLog(...args) {
    if (process.env.DEBUG) {
        console.log(...args);
    }
}

function print(...args) {
    term(`${args.join()}\n`);
}

/**
 *
 * @param imageBuffers - Array of image buffers
 * @return {Promise<exports.PNG>} - A PNG object (PNGjs specific)
 */
function createGridUsingBitBlt(imageBuffers) {
    return new Promise((resolve, reject) => {
        let images = imageBuffers.map(buffer => PNG.sync.read(buffer));

        // Assuming all images are the same size
        let width = images[0].width;
        let height = images[0].height;

        let result = new PNG({
            width: width * 2,
            height: height * 2,
            colorType: 2
        });

        for (let i = 0; i < images.length; i++) {
            let image = images[i];

            // Calculate position
            let x = (i % 2) * width;
            let y = Math.floor(i / 2) * height;

            debugLog(`Bit blitting image ${i} at x=${x} y=${y}`);
            PNG.bitblt(image, result, 0, 0, width, height, x, y);
        }

        resolve(result);
    });
}

async function createPngFromBuffer(buffer) {
    return new Promise((resolve, reject) => {
        const png = new PNG({ colorType: 2});
        png.parse(buffer, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(png);
            }
        });
    });
}

async function writePngToFile(pngObj, localFileName) {

    return new Promise((resolve, reject) => {
        pngObj.pack().pipe(fs.createWriteStream(localFileName)).on("finish", () => {
            debugLog("PNG written to file");
            resolve();
        });
    });

}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function throwIfUndefinedOrNull(identifer, ...args) {
    if (args.some(a => a === undefined || a === null || (Array.isArray(a) && a.length === 0))) {
        throw new Error(`${identifer} has null/undefined/empty collection`);
    }
}


async function fetchBinary(url, local_file) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`unexpected response ${response.statusText}`);
    }

    const ws = createWriteStream(local_file);
    const pipeline_promise = await pipeline(response.body, ws);
    return pipeline_promise;
}

async function fetchAsBuffer(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`unexpected response ${response.statusText}`);
    }

    const buffer = await response.buffer();
    return buffer;
}

async function isBufferAnImage(buffer) {
    const result = await fileTypeFromBuffer(buffer);
    return result?.mime?.startsWith('image/');
}


export {
    sleep,
    throwIfUndefinedOrNull,
    fetchBinary,
    fetchAsBuffer,
    isBufferAnImage,
    createGridUsingBitBlt,
    createPngFromBuffer,
    writePngToFile,
    print
}
