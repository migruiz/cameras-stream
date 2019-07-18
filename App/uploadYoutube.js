'use strict';

/**
 * Usage: node upload.js PATH_TO_VIDEO_FILE
 */

const fs = require('fs');
const util = require('util');
const readline = require('readline');
const { from,of,Observable,forkJoin,iif,throwError,defer } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap,catchError,concatMap,endWith} = require('rxjs/operators');
const { oauthStream } = require('./googleOauth');
const {google} = require('googleapis');


const removeFile = path =>  from(util.promisify(fs.unlink)(path));

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
        }
      )

);




const resultStream =function(fileName){
  return oauthStream(auth => uploadVideoStream(auth,fileName))
    .pipe(
      mergeMap(v => removeFile(path).pipe(endWith(v))),
      map(v => `https://youtu.be/${v.data.id}`)
      );
}



exports.uploadVideoStream = resultStream