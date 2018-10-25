'use strict';

import request from 'request';
import { URL } from 'url';
import moment from 'moment';
import { logger } from '../logger';

const DAY_IN_MS = 86400000;
const HOUR_IN_MS = 3600000;
const MINUTE_IN_MIS = 60000;
const SECOND_IN_MS = 1000;

function strEncodeUTF16 (str) {
  const buf = new ArrayBuffer(str.length * 2);
  const bufView = new Uint16Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return new Uint8Array(buf);
}

export class Server {
  constructor (initData) {
    this.name = initData.name;
    this.port = initData.port;
    this.URL = `${initData.baseURL}${this.port}`;
    this.status = {
      isUp: false,
      startTime: ''
    };
  }

  getLifeTime () {
    const currentTime = moment();
    let duration = currentTime.diff(this.status.startTime);

    let days;
    let hours;
    let minutes;
    let seconds;

    days = parseInt(duration / DAY_IN_MS);
    duration = duration % DAY_IN_MS;
    hours = parseInt(duration / HOUR_IN_MS);
    duration = duration % HOUR_IN_MS;
    minutes = parseInt(duration / MINUTE_IN_MIS);
    duration = duration % MINUTE_IN_MIS;
    seconds = parseInt(duration / SECOND_IN_MS);
    duration = duration % SECOND_IN_MS;
    return `Up Time: ${days}:${hours}:${minutes}:${seconds}:${duration}`;
  }

  checkHealth () {
    return new Promise(resolve => {
      request
        .get({ url: new URL(this.URL) })
        .on('response', (response) => {
          this.status.isUp = true;
          if (this.status.startTime) {
            logger.info(`${this.name} port: ${this.port} \x1b[1m\x1b[32m\u{2714}\x1b[0m ${this.getLifeTime()}`);
          } else {
            this.status.startTime = moment();
            logger.info(`${this.name} port: ${this.port} \x1b[1m\x1b[32m\u{2714}\x1b[0m ${this.getLifeTime()}`);
          }
          resolve();
        })
        .on('error', () => {
          this.status.isUp = false;
          this.status.startTime = '';
          logger.warn(`${this.name}: port: ${this.port} \x1b[1m\x1b[31m\u{2716}\x1b[0m`);
          resolve();
        });
    });
  }

  route () {
    return (req, res, next) => {
      if (req.originalUrl[req.originalUrl.length - 1] !== '/') req.originalUrl += '/';
      let orgURL = req.originalUrl.split('/');
      const prefix = orgURL[1];
      if (this.name === prefix) {
        if (!this.status.isUp) {
          res.send({ error: 'The Server you requested is currently unavailable. Please try again later' });
        } else {
          let filteredURL = orgURL.reduce((accVal, currVal) => {
            if (!accVal) accVal = '';
            if (currVal !== prefix) return `${accVal}/${currVal}`;
          });

          const url = new URL(`${this.URL}${filteredURL}`);

          const gateKeeper = request({ url }).on('error', error => {
            logger.error(error);
            return res.status(500).send(error);
          });

          req.pipe(gateKeeper).pipe(res);
        }
      } else {
        next();
      }
    };
  }
}
