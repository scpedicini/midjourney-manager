# Midjourney-Manager 

Welcome to Midjourney-Manager, your friendly command-line application for managing your generative images! Available for both Windows and Mac, this application is designed to help you keep track of your creations, download them and embed information about each image including the discord channel, the prompt used, the job ID, and more. It even downloads upscales and image collages aka the image grids for you! :framed_picture:

## :star: Features

- Download all of your images generated using Midjourney
- Track images you've already downloaded
- Embed information about each generative image
- Download upscales and image collages

## :exclamation: Limitations
Due to the way that Midjourney's current profile works, it is impossible to search past the most recent 2500 generated images. Hence, we recommend you run this script on a daily/weekly basis to always ensure your work is backed up. :hourglass_flowing_sand:

## :rocket: Getting Started

1. Under releases, download the version suitable for your OS (Win or Mac). We recommend placing this file in the directory where you'd like to have your images downloaded to. :file_folder:

2. Before running the application, you'll need the following information:
    - `__Secure-next-auth.session-token` (You can get this cookie from the Cookie tab in Chrome/Firefox developer console. Watch the video tutorial below for more details)
    - User Id (Search for any call that says "user_id" in the Network tab. It should be in the form of GUID (e.g. `XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`). Copy this value.

Please note that the session-token should be good for several weeks. When it expires, you will receive a warning message, and will need to grab the newest one from your browser.

For detailed instructions, watch this [video tutorial](#) :movie_camera:

You can run the CLI tool by either double-clicking on it, or by manually running the tool in a DOS prompt or terminal: `./mj-downloader` (for Mac) or `mj-downloader.exe` (for Windows).

## :hammer_and_wrench: Building Yourself

If you'd like to build the project yourself, make sure you have Node v16 installed. Then use the npm scripts `mac-build` and `win-build` to create the respective bundle for Mac and Windows. Please note that due to the bundling tool used (`caxa`), it is necessary to build the respective compiled executable for Mac/Windows on the native target's OS.

## :question: FAQ

### I'm getting errors while downloading, what do I do?

Depending on how much load Midjourney's site is under, it is not uncommon to receive time outs and other types of failures while downloading images. If this happens, Midjourney-Manager will skip these images and continue on. You can re-run the tool and it will pick up where it left off and try to fetch these images again.

### Will it download the same images?

No, Midjourney-Manager tracks downloads via a file called `downloaded.json` which exists in the download directory. This means that even if you move the images to other folders, as long as you keep the `downloaded.json` file around, it won't download duplicate files.

### Where is my image information?

You can see the information embedded in an image using a dedicated tool such as [exiftool](https://exiftool.org), or via most popular image editors. If you choose to generate sidecar files, every image will have a corresponding metadata file entry with the same name ending in `.json`.

![Exiftool CLI Output](assets/exiftool.jpg)

### How do I exit this dumb program?

You can exit the tool at any time by pressing `Escape` on your keyboard. This will stop the tool from downloading any more images, and will save the current state of the `downloaded.json` file.

### What are sidecar files?

Sidecar files are 1-1 files that include information related to the generation of the image. These include details such as:
- Version used (v3, v4, v5.1, niji, etc)
- Resolution
- Aspect ratio
- Prompt
- Seed
- etc

### Why aren't the images being downloaded in parallel?

Because you touch yourself at night. That's why.

### I can't run the tool, MacOS says it's from an unidentified developer.

You'll need to open up the Security & Privacy settings and allow the app to run.

![MacOS Security & Privacy](assets/gatekeep-warning.jpg)

## :construction_worker: Contributing

If you have any issues, suggestions or general feedback, don't hesitate to reach out or submit a pull request. Happy downloading! :sparkles: :sparkles: :sparkles: