/**
 * MIT License
 *
 * Copyright (c) 2018 Cribl.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const zlib = require('zlib');
const AWS = require('aws-sdk');
const https = require('https');
const http = require('http');
const url = require('url');


const s3 = new AWS.S3();

// eg. 49669812345_vpcflowlogs_us-west-1_fl-029ac4640f208XXXX_20181121T0150Z_cba5dbb2.log.gz
const VPC_FILENAME_REGEX = /\/(\d+)_vpcflowlogs_([^_]+)_.*\.gz$/;

//eg. 49669812345_CloudTrail_us-west-1_20181122T0000Z_cnnBR16qS5iWqbJ1.json.gz
const CLOUDTRAIL_FILENAME_REGEX = /\/(\d+)_CloudTrail_([^_]+)_.*\.json\.gz$/;

// e.g.  49669812345_elasticloadbalancing_us-west-1_a2bc0a431ec4011e795fa06dd8a3XXXX_20180608T2245Z_54.187.134.00_n1k52gg1.log
const ELB_FILENAME_REGEX = /\/(\d+)_elasticloadbalancing_([^_]+)_([^_]+)_([^_]+)_([^_]+)_.*\.log(\.gz)?$/;
//e.g. 2018-11-07T02:35:07.838294Z a2bc0a431ec4011e795fa06DDD3XXXX 173.212.254.88:53730 172.20.58.242:30606 0.000549 0.00001 0.000012 - - 98 423 "- - - " "-" ECDHE-RSA-AES128-GCM-SHA256 TLSv1.2
const ELB_PARSE_REGEX = /^(\d\S+)\s+(\S+)\s+([\d.]+):(\d+)\s+([\d.]+):(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d-]+)\s+([\d-]+)\s+(\d+)\s+(\d+)\s+"([^"]+)"\s+"([^"]+)"\s+([-\w]+)\s+([-\w.]+)$/;
// from: https://docs.aws.amazon.com/elasticloadbalancing/latest/classic/access-log-collection.html?icmpid=docs_elb_console
const ELB_FIELDS = ['timestamp', 'elb', 'client_ip', 'client_port', 'backend_ip', 'backend_port', 'request_processing_time', 'backend_processing_time', 'response_processing_time', 'elb_status_code', 'backend_status_code', 'received_bytes', 'sent_bytes', 'request', 'user_agent', 'ssl_cipher', 'ssl_protocol'];

// e.g https 2018-07-02T22:23:00.186641Z app/my-loadbalancer/50dc6c495c0c9188 192.168.131.39:2817 10.0.0.1:80 0.086 0.048 0.037 200 200 0 57 "GET https://www.example.com:443/ HTTP/1.1" "curl/7.46.0" ECDHE-RSA-AES128-GCM-SHA256 TLSv1.2 arn:aws:elasticloadbalancing:us-east-2:123456789012:targetgroup/my-targets/73e2d6bc24d8a067 "Root=1-58337281-1d84f3d73c47ec4e58577259" "www.example.com" "arn:aws:acm:us-east-2:123456789012:certificate/12345678-1234-1234-1234-123456789012" 1 2018-07-02T22:22:48.364000Z "authenticate,forward" "-"
const ALB_PARSE_REGEX = /^([a-zA-Z]\S+)\s+(\S+)\s+(\S+)\s+([\d.]+):(\d+)\s+([\d.]+):(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d-]+)\s+([\d-]+)\s+(\d+)\s+(\d+)\s+"([^"]+)"\s+"([^"]+)"\s+([-\w]+)\s+([-\w.]+)\s+(\S+)\s+"([^"]+)"\s+"([^"]+)"\s+"([^"]+)"\s+([-\d]+)\s+(\S+)\s+"([^"]+)"\s+"([^"]+)"$/;
// from: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-access-logs.html
const ALB_FIELDS = ['type', ...ELB_FIELDS, 'backend_group_arn', 'trace_id', 'domain_name', 'chosen_cert_arn', 'matched_rule_priority', 'request_creation_time', 'actions_executed', 'redirect_url'];


// eg. E1VXRJJS5KC0JK.2018-11-20-23.0128d8dc.gz
const CDN_FILENAME_REGEX = /\/[a-zA-Z0-9]+\.\d+-\d+-\d+-\d+\.[a-zA-Z0-9]+\.gz$/;

function asNumberIfPossible(val, decode) {
  const vNum = Number(val);
  return Number.isNaN(vNum) ? (decode ? decode(val) : val) : vNum;
}

function lineToEvent(line, delim, fields, decode) {
  const parts = line.split(delim);
  const event = {};
  for (let p=0; p<parts.length && p<fields.length; p++) {
    const val = parts[p];
    event[fields[p]] = asNumberIfPossible(val, decode);
  }
  return event;
}

function normalizeFieldName(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+/g, '').replace(/_+$/g, '').toLowerCase();
}

// details: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/AccessLogs.html#LogFileFormat
function cloudfrontUrlDecode(val) {
  if (val.indexOf('%') < 0) {
    return val;
  }
  // a few chars are double uri encoded ... WIN!!!
  return decodeURIComponent(val).replace(/%(20|22|5C)/g, function(val) {
    if(val === '%20') return ' ';
    if(val === '%22') return '"';
    if(val === '%5C') return '\\';
    return val;
  });
} 

function parseEvents(fullKey, buf) {
  let p = Promise.resolve(buf);
  // gunzip iff necessary
  if (fullKey.endsWith('.gz') || (buf.length > 2 && buf[0] === 0x1F && buf[1] === 0x8B && buf[2] === 0x08)) {
    p = p.then(() => new Promise((resolve, reject) => {
      zlib.gunzip(buf, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    }));
  }

  return p.then(data => {
    const events = [];

    // check for VPC flow logs
    if (VPC_FILENAME_REGEX.test(fullKey)) {
      const match = VPC_FILENAME_REGEX.exec(fullKey);
      const DELIM = ' ';
      const lines = data.toString().split(/\r?\n/);
      const header = lines[0].split(DELIM).map(normalizeFieldName);
      for (let i=1; i<lines.length; i++) {
        const line = lines[i].trim();
        if (line.length) {
          const event = lineToEvent(line, DELIM, header);
          event._time = event.start;
          event._raw = line;
          event.source = fullKey;
          event.origin = 'lambda:vpcflowlogs';
          event.region = match[2];
          events.push(event);
        }
      }
      return events;
    }

    // check for CloudFront logs
    if (CDN_FILENAME_REGEX.test(fullKey)) {
      const DELIM = '\t';
      const lines = data.toString().split(/\r?\n/);
      if (lines.length < 2) {
        return Promise.reject(new Error(`CDN file too small key=${fullKey}`));
      }
      if (!lines[1].startsWith('#Fields: ')) {
        return Promise.reject(new Error(`Failed to find valid CDN header line, key=${fullKey}`));
      }
      const header = lines[1].substr('#Fields: '.length).split(' ').map(normalizeFieldName);
      for (let i=2; i<lines.length; i++) {
        const line = lines[i].trim();
        if (line.length) {
          const event = lineToEvent(line, DELIM, header, cloudfrontUrlDecode);
          event._time = Date.parse(`${event.date} ${event.time} GMT`)/1000;
          event._raw = line;
          event.source = fullKey;
          event.origin = 'lambda:cloudfrontlogs';
          events.push(event);
        }
      }
      return events;
    }

    // check for ELB/ALB logs
    if (ELB_FILENAME_REGEX.test(fullKey)) {
      const match = ELB_FILENAME_REGEX.exec(fullKey);
      const region = match[2];
      const elb_ip = match[5];
      const origin = 'lambda:elb';
      const source = fullKey;

      const lines = data.toString().split(/\r?\n/);
      for(let i=0;i<lines.length; i++) {
        const _raw = lines[i].trim();
        if (_raw.length) {
          const e = { _raw, origin, source, region, elb_ip };
          let m = ELB_PARSE_REGEX.exec(_raw);
          let timestampIdx = 0;
          let fields = ELB_FIELDS;
          if(!m) { // try ALB
            m = ALB_PARSE_REGEX.exec(_raw);
            timestampIdx = 1;
            fields = ALB_FIELDS;
          }

          if (m) {
            const tParts = m[timestampIdx + 1].split('.');
            // handle parsing of more than just milliseconds manually
            e._time = Date.parse(`${tParts[0]}Z`)/1000 + Number(`0.${tParts[1].substr(0, tParts[1].length - 1)}`);
            for (let k=0; k<fields.length && k<m.length; k++) {
              if (k !== timestampIdx) {
                e[fields[k]] = asNumberIfPossible(m[k+1]);
              }
            }
          }
          events.push(e);
        }
      }
      return events;
    }

    // check for CloudTrail logs
    if (CLOUDTRAIL_FILENAME_REGEX.test(fullKey)) {
      const records = JSON.parse(data.toString()).Records || [];
      const source = fullKey;
      const origin = 'lambda:cloudtrail';
      // not need to add region, it is already in playload as awsRegion
      for (let i=0; i<records.length; i++) {
        events.push({ _time: Date.parse(records[i].eventTime)/1000, source, origin, _raw: JSON.stringify(records[i]) });
      }
      return events;
    }

    return Promise.reject(new Error(`unknown file type, Key=${fullKey}`));
  });
}

// POST ~1MB chunks to Cribl
function sendEventsToCribl(events) {
  if (!Array.isArray(events) || events.length === 0) {
    console.log('nothing to send ...');
    return Promise.resolve();
  }
  return Promise.resolve().then(() => {
    const u = new url.URL(process.env.CRIBL_URL);
    const authToken = process.env.CRIBL_AUTH;
    const headers = {};
    if (authToken) {
      headers.Authorization = authToken;
    }
    const reqInfo = {
      host: u.hostname,
      port: u.port,
      method: 'POST',
      path: u.pathname,
      headers,
      rejectUnauthorized: false
    };

    let payload = '';
    const reqProms = [];

    const sendPayload = () => {
      if (payload.length === 0) {
        return;
      }
      reqProms.push(new Promise((resolve, reject) => {
        console.log(`making http request: ${JSON.stringify(reqInfo)}, payload.length=${payload.length}`);
        const req = (u.protocol.startsWith('https') ? https : http)
          .request(reqInfo, (res) => {
            let body = '';
            res.on('data', d => body += d.toString()); // ignore resp
            res.on('end', () => {
              console.log(`ending with body: ${body}`);
              if (res.statusCode < 200 || res.statusCode >= 300) {
                reject(new Error(`statusCode=${res.statusCode} body=${body}`));
              } else {
                resolve();
              }
            });
          });

        req.on('error', (err) => {
          reject(err);
        });
        req.end(payload);
      }));
    };

    // split requests into ~1MB chunks
    for (let i = 0; i < events.length; i++) {
      payload += JSON.stringify(events[i]);
      payload += '\n';
      if (payload.length > 1024 * 1024) {
        sendPayload();
        payload = '';
      }
    }
    sendPayload();
    return Promise.all(reqProms);
  });
}

exports.handler = (event, context, callback) => {
  if (!Array.isArray(event.Records) || event.Records.length === 0) {
    console.log('Missing or empty event.Reords, exiting ...');
    callback(new Error('Missing or Empty event.Records'));
    return;
  }

  const proms = event.Records.map(r => {
    if (!r.eventName.startsWith('ObjectCreated:')) {
      console.log(`ignoring record, eventName=${r.eventName}`);
      return Promise.resolve();
    }
    const Bucket = r.s3.bucket.name;
    const Key = decodeURIComponent(r.s3.object.key.replace(/\+/g, ' '));
    const fullKey = `s3://${Bucket}/${Key}`;
    console.log(`START process obj=${fullKey}`);
    return s3.getObject({ Bucket, Key }).promise()
      .then(resp => parseEvents(fullKey, resp.Body))
      .then(sendEventsToCribl)
      .then(() => console.log(`DONE process obj=${fullKey}`))
      .catch(err => console.log(`error while processing obj=${Key}, err=${err.message}`));
  });

  Promise.all(proms)
    .then(() => callback(), callback);
};


