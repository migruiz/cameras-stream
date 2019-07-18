'use strict';

/**
 * Usage: node upload.js PATH_TO_VIDEO_FILE
 */

const fs = require('fs');
const util = require('util');
const readline = require('readline');
const { from,of,Observable,forkJoin,iif,throwError,defer } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap,catchError,concatMap} = require('rxjs/operators');

const {google} = require('googleapis');


const fileStream = path =>  from(util.promisify(fs.readFile)(path));
const readDirStream = path =>  from(util.promisify(fs.readdir)(path));
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



const oAuthGoogle = fileName => fileStream(fileName).pipe
(
    map(cr => JSON.parse(cr)),
    map(cr => new google.auth.OAuth2(cr.installed.client_id, cr.installed.client_secret, cr.installed.redirect_uris[0])),
)
const oUathToken = fileName =>  fileStream(fileName).pipe
(
    map(cr => JSON.parse(cr))
)






const uploadCompleteStream = (authInfo,videofileName) => oAuthGoogle(authInfo.credential).pipe(
    map(oUth => ({oUth})),
    mergeMap(v => oUathToken(authInfo.token).pipe(map(token => Object.assign({token}, v)))),
    tap(v => v.oUth.setCredentials(v.token)),
    mergeMap(v => uploadVideoStream(v.oUth,videofileName))    
)



const uploadYoutubeQuotaStream = (projects,index,videofileName) => uploadCompleteStream(projects[index],videofileName)
  .pipe(  
    catchError(err => iif(() => index < projects.length - 1 && err.code===403,  defer(() => uploadYoutubeQuotaStream(projects,index+1,videofileName)), throwError(err) ) )
    )

const credesDir = '/secrets/yt'
const readDirsStream = 
readDirStream(credesDir).pipe(
  concatMap(v => v),
  map(v => ({
    credential: `${credesDir}/${v}/credentialsCam.json`,
    token: `${credesDir}/${v}/tokenCam.json`
  })),
  tap(v=>console.log(v)),
  toArray()
)

const resultStream = videofileName => readDirsStream.pipe(concatMap(arr=> uploadYoutubeQuotaStream(arr,0,videofileName)))



exports.uploadVideoStream = resultStream