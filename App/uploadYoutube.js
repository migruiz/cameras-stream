'use strict';

/**
 * Usage: node upload.js PATH_TO_VIDEO_FILE
 */

const fs = require('fs');
const util = require('util');
const readline = require('readline');
const { from,of,Observable,forkJoin } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap} = require('rxjs/operators');

const {google} = require('googleapis');


const fileStream = path =>  from(util.promisify(fs.readFile)(path));
const uploadVideoStream =(auth,fileName) => from(

    google.youtube({
        version: 'v3',
        auth: auth,
      }).videos.insert(
        {
          part: 'id,snippet,status',
          notifySubscribers: false,
          requestBody: {
            snippet: {
              title: 'Video CAM',
              description: 'Testing YouTube upload',
            },
            status: {
              privacyStatus: 'unlisted',
            },
          },
          media: {
            body: fs.createReadStream(fileName),
          },
        },
        {
          onUploadProgress: evt => {

          },
        }
      )

);


const oAuthGoogle = fileStream('/secrets/credentialsCam.json').pipe
(
    map(cr => JSON.parse(cr)),
    map(cr => new google.auth.OAuth2(cr.installed.client_id, cr.installed.client_secret, cr.installed.redirect_uris[0])),
)
const oUathToken = fileStream('/secrets/tokenCam.json').pipe
(
    map(cr => JSON.parse(cr))
)



const uploadCompleteStream = fileName => oAuthGoogle.pipe(
    map(oUth => ({oUth})),
    mergeMap(v => oUathToken.pipe(map(token => Object.assign({token}, v)))),
    tap(v => v.oUth.setCredentials(v.token)),
    mergeMap(v => uploadVideoStream(v.oUth,fileName)),
    map(v => `https://youtu.be/${v.data.id}`),
    tap(v => console.log(v))
)


exports.uploadVideoStream = uploadCompleteStream