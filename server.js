import * as fs from 'fs';
import {rest} from 'msw';
import {setupServer} from 'msw/node';

const jsonData = JSON.parse(fs.readFileSync('./simulated-dashboard-image-data.json', 'utf8'));
// network requests which match https://www.midjourney.com/api/app/recent-jobs/*
// will be handled by this mock service worker and return a JSON response

const server = setupServer(
    rest.get('https://www.midjourney.com/api/app/recent-jobs/*', (req, res, ctx) => {
        server.close();
        return res(ctx.json(jsonData));
    }),
    // // pass through any requests not handled above to regular real network
    // rest.get('*', (req, res, ctx) => {
    //     return ctx.fetch(req);
    // })
);

server.listen();

