import jsonData from '../midjourney-app-har-data-2.har.json' assert {type: "json"};
import {readFileSync, writeFileSync} from "fs";
import {jsonrepair} from "jsonrepair";

try {
    console.log("Starting")

// const rawFile = readFileSync('/Users/shaun/data/Samples/huge_lorem.txt');

//const har = JSON.parse(rawFile);
    const allImages = [];

    const entries = jsonData.log.entries;

    for (const entry of entries) {
        if (/^https:\/\/www\.midjourney\.com\/api\/app\/recent-jobs\//i.test(entry.request.url)) {
            console.log(entry.request.url)

            const jsonImages = JSON.parse(jsonrepair(entry?.response?.content?.text || "[]"));

            // console.log(jsonImages);

            if(jsonImages.length > 500) {
                console.log(`Too many images: ${jsonImages.length}`);
            }

            allImages.push(...jsonImages);

        }
    }

    // write the images to a file

    const idToImageMap = {};
    allImages.forEach(image => {
        if (image['id']) {
            console.log(`No id for image ${image}`);
            if (!idToImageMap[image.id]) {
                idToImageMap[image.id] = image;
            } else {
                console.log(`Duplicate image id ${image.id}`);
            }
        } else {
            console.log(`No id for image ${image}`);
        }
    });

    writeFileSync('simulated-dashboard-image-data.json', JSON.stringify(Object.values(idToImageMap), null, 4));

    console.log("Done")
} catch (e) {
    console.error(e)
}