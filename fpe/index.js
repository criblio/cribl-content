exports.name = 'FPE Encryption';
exports.version = '0.1';
exports.group = 'Demo Function';

const dns = require('dns');
const crypto = require('./fpe');
const cipher = crypto({});                                                                                                                                               
 
const ipv4Regex = /(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/gm;
const cache = {};

function doEncryption(IP, midx) {
  if (!cache[IP]) {
    cache[IP] = {
      promise: new Promise((resolve, reject) => { // eslint-disable-line
        dns.reverse(IP, (err) => {
            if (!err) {
		const enc = cipher.encrypt(IP);
		const value = [`fpe${midx !== 1 ? midx.toString() : ''}`, enc.toString()];
		cache[IP].value = value;
		resolve(value);
            } else {
		resolve([]);
            }
        });
      }),
    };
    return cache[IP].promise;
  } else if (!cache[IP].value) {
    return cache[IP].promise;
  }
  return Promise.resolve(cache[IP].value);
}

exports.disabled = 0;
exports.asyncTimeout = 500; // ms
exports.process = (event) => {
  const promises = [];
  let matches;
  let matchIdx = 1;
  ipv4Regex.lastIndex = 0; // ensure this is properly reset
  while (matches = ipv4Regex.exec(event._raw)) {
    const midx = matchIdx;
    const IP = matches[0];
    promises.push(doEncryption(IP, midx));
    matchIdx++;
  }
  if (promises.length === 0) {
    return event;
  }
  return Promise.all(promises)
    .then((entries) => {
      entries.filter(e => e !== undefined).forEach(e => {
        event[e[0]] = e[1];
      });
      return event;
    })
    .catch(() => {
      return event;
    });
};
