
// Log start
const dLogger  = C.util.getLogger('func:send_to_kvstore');
let conf;

// Generic logger to switch from dLogger to console.log
function mylogger(message){
    dLogger.info(message)
    //console.log(message)
}

// Function to create a new event in KV store
function new_entry(kv_event, kvstore, kvApp, kvuser, kvpass){ 
    const https = require('https')
    const data = JSON.stringify(kv_event)
    const sPath = '/servicesNS/nobody/' + kvApp + '/storage/collections/data/' + kvstore
    mylogger("new_entry    || uri=" + sPath)
    return new Promise((resolve, reject) => {
        const authString = Buffer.from(kvuser + ":" + kvpass).toString('base64')
        const options = {
            hostname: '127.0.0.1',
            port: 8089,
            path: sPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'Authorization' : "Basic " + authString
            }
        }
        // Ignore self signed certs
        process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
        const req = https.request(options, (res) => {
            mylogger(`new_entry    || statusCode: ${res.statusCode}`);
            res.on('data', (d) => {
                mylogger(`new_entry    || data returned ${d}`);
            });
            res.on('end',() => {
                resolve(true);
            });
        })
        
        req.on('error', (error) => {
            mylogger(error)
            reject(error);
        })
        
        req.write(data)
        req.end()
    });
};

// Function to update an event in KV store
function update_entry(session_key, kv_event, kvstore, kvApp, kvuser, kvpass){
    const https = require('https')
    const data = JSON.stringify(kv_event)
    const sPath = '/servicesNS/nobody/' + kvApp + '/storage/collections/data/'+ kvstore + '/' + session_key
    mylogger("update_entry || uri=" + sPath)
    const authString = Buffer.from(kvuser + ":" + kvpass).toString('base64')
    const options = {
        hostname: '127.0.0.1',
        port: 8089,
        path: sPath,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
            'Authorization' : "Basic " + authString
        }
    }
    // Ignore self signed certs
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
    return new Promise(function(resolve, reject) {
        const req = https.request(options, (res) => {
            mylogger(`update_entry || statusCode: ${res.statusCode}`)
            res.on('data', (d) => {
              //process.stdout.write(d)
              mylogger(`update_entry || data returned ${d}`);
            });
            res.on('end', () => {
              resolve(true);
            });
        })
        
        req.on('error', (error) => {
            mylogger("update_entry || error:" + error);
            reject(false);
        })
        
        req.write(data);
        req.end();
    });
};

// Function to get the unique key for the session_object_guid passed.
function get_kv_key(guid, kvstore, kvFilter, kvApp, kvuser, kvpass){
  // Getting KV key based on GUID
  const https = require('https')
  const sPath = '/servicesNS/nobody/' + kvApp + '/storage/collections/data/' + kvstore
  const query = '?query=' + encodeURIComponent('{"'+ kvFilter +'":"' + guid + '"}')
  const queryStr = sPath + query
  mylogger("get_kv_key   || queryStr = " + queryStr)
  const authString = Buffer.from(kvuser + ":" + kvpass).toString('base64')
  const options = {
      hostname: '127.0.0.1',
      port: 8089,
      path: queryStr,
      method: 'GET',
      headers: {
          'Content-Type': 'application/json',
          'Authorization' : "Basic " + authString
      }
  }
  // Ignore self signed certs
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
  return new Promise((resolve, reject) => {
    https.get(options, (resp) => {
      let rawData = '';

      resp.on('data', (chunk) => {
        rawData += chunk;
      });

      resp.on('end', () => {
        try {
          var parsedData = JSON.parse(rawData);
          if (parsedData.length >= 1) {
            var session_key = parsedData[0]['_key']
            mylogger("get_kv_key   || session_key=" + session_key)
            resolve(session_key);
          }
          else{
            mylogger("get_kv_key   || no session found")
            resolve("no session");
          }
          
        } catch (e) {
          reject(`Error: ${e.message}`);
        }
      });

    }).on('error', (err) => {
      //dLogger.error(`Error in REST Lookup: ${err.message}`);
      reject(`Error: ${err.message}`);
    });
  });
};

// Function definition for Cribl
exports.name = 'send_to_kvstore';
exports.version = '0.1';
exports.group = 'Demo Functions';
exports.disabled = 0;
exports.init = (opts) => {
    // Get configured options passed by UI
    conf = (opts || {}).conf || {};
    // Log collection name
    mylogger(`init         || kvstore  = ${conf.collection}`);
    mylogger(`init         || app      = ${conf.application}`);
    mylogger(`init         || username = ${conf.username}`);
    mylogger(`init         || filter   = ${conf.filter}`);
    mylogger(`init         || fields   = ${conf.updateme}`);
};

// Process for event
exports.process = (event) => {
  // Set timer start
  let start = process.hrtime();

  // Get the name, user, pass for the KV store from options
  let kvStore   = conf.collection;
  let kvApp     = conf.application;
  let kvFilter  = conf.filter;
  let kvUser    = conf.username;
  let kvPass    = conf.password;
  let kvFields  = conf.updateme;

  // Log collection name
  mylogger(`process      || kvstore  = ${kvStore}`);
  mylogger(`process      || app      = ${kvApp}`);
  mylogger(`process      || username = ${kvUser}`);
  mylogger(`process      || filter   = ${kvFilter}`);
  mylogger(`process      || fields   = ${kvFields}`);

  // create kvEvent 
  let kvEvent = {};

  // add kv fields
  for (let i = 0; i < kvFields.length; i++) {
    let key = kvFields[i];
    let val = event[key];
    mylogger("process      || adding field [" + key + "] with value [" + val + "] to kvEvent");
    kvEvent[key] = val;
  }

  mylogger(` -------  --------- `)
  mylogger(kvEvent)
  mylogger(` -------  --------- `)

  // Get session_object_guid from event
  let event_guid = event[kvFilter]
  mylogger("process      || processing event for guid [" + event_guid + "]")

  // Use get_kv_key to determine if session is already in the KV store
  return get_kv_key(event_guid, kvStore, kvFilter, kvApp, kvUser, kvPass)
   .then(function(result) {
        mylogger("promise      || get_kv_key returned [" + result + "]");
        if(result == "no session"){
            mylogger("promise      || " + result + " creating session entry"); // "Stuff worked!"
            return new_entry(kvEvent, kvStore, kvApp, kvUser, kvPass).then((result) => {
                mylogger("new_entry    || returned - " + result);
            });
        } else {
            mylogger("promise      || _key found [" + result + "] updating entry"); // "Stuff worked!"
            return update_entry(result, kvEvent, kvStore, kvApp, kvUser, kvPass).then((result) => {
                mylogger("update_entry || returned - " + result);
            });
        }
    })
    .catch(function(err) {
        mylogger("function     || unable to create session, returned - " + error.message);
        return false;
    })
    .catch(error => {
        // ops, you're friend is not ready :o
        mylogger("function     || returned - " + error.message);
    })
    .then(() => {
        let end = process.hrtime(start)
        mylogger(`Script       || Execution time (hr): ${end[0]}s ${end[1] / 1000000}ms`)
        return event;
    });
};