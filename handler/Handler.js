'use strict';

import request from 'request';
import { URL } from 'url';

export default function (baseURL) {
  const self = this;
  self.baseURL = baseURL;

  self.run = (servers) => {
    return (req, res, next) => {
      if (req.originalUrl[req.originalUrl.length - 1] !== '/') req.originalUrl += '/';
      let orgURL = req.originalUrl.split('/');
      const prefix = orgURL[1];
      const server = servers.filter(server => (server.name === prefix))[0];
      if (server) {
        if (!server.status.isUp) {
          res.send({ error: 'The Server you requested is currently unavailable. Please try again later' });
        } else {
          let filteredURL = orgURL.reduce((accVal, currVal) => {
            if (!accVal) accVal = '';
            if (currVal !== prefix) return `${accVal}/${currVal}`;
          });

          const url = new URL(`${self.baseURL}${server.port}${filteredURL}`);

          const gateKeeper = request({ url }).on('error', error => {
            console.error(error);
            return res.status(500).send(error);
          });

          req.pipe(gateKeeper).pipe(res);
        }
      } else res.sendStatus(404);
    };
  };
}
