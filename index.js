'use strict';

import '@babel/polyfill';
import config from 'config';
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import { Server } from './models/Server';
import { logger } from './logger';

const serversData = config.get('SERVERS');
const BASE_URL = config.get('BASE');

const NATIVE_ROUTES = ['', 'css', 'js', 'img'];

const app = express();
let servers = [];
for (let data of serversData) {
  servers.push(new Server(Object.assign({ baseURL: BASE_URL }, data)));
}

(async () => {
  for (let server of servers) {
    await server.checkHealth();
  }

  setInterval(async () => {
    for (let server of servers) {
      await server.checkHealth();
    }
  }, 10000);

  morgan.token('remote-addr', (req, res) => {
    return req.connection.remoteAddress.replace(/::ffff:/g, '');
  });

  app.use(morgan({
    stream: logger.stream,
    format: `[LOG] ORIGIN ADDR: :remote-addr | LOCATION: :method :url | STATUS CODE: :status - :response-time[3]ms`
  }));

  app.use(cors({
    origin: (origin, callback) => {
      callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: true
  }));

  app.use('/', express.static('./public/'));
  app.use('/css', express.static('./public/css/'));
  app.use('/js', express.static('./public/js'));
  app.use('/img', express.static('./public/img'));

  for (let server of servers) {
    app.use(server.route());
  }

  app.use((req, res, next) => {
    if (!res.headersSent) {
      if (!NATIVE_ROUTES.includes(req.originalUrl.split('/')[1])) {
        res.redirect('/');
      } else next();
    }
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) next(err);
    else {
      if (req.originalUrl[req.originalUrl.length - 1] !== '/') req.originalUrl += '/';
      let orgURL = req.originalUrl.split('/');
      const prefix = orgURL[1];
      const server = servers.filter(server => (server.name === prefix))[0];
      server.status.isUp = false;
      res.status(500).send(err.message);
    }
  });

  app.listen(config.get('PORT'));
  logger.info(`Load Balancer listening on port ${config.get('PORT')}`);
})();
