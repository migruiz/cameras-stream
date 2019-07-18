'use strict';

/**
 * Usage: node upload.js PATH_TO_VIDEO_FILE
 */

const fs = require('fs');
const util = require('util');
const path = require('path');
const { from,of,Observable,forkJoin,iif,throwError,defer,interval } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap,catchError,concatMap,filter} = require('rxjs/operators');

const removeFile = path =>  from(util.promisify(fs.unlink)(path));
const readDirStream = path =>  from(util.promisify(fs.readdir)(path));
const videosFolder = '/videos/'

const resultStream =  readDirStream(videosFolder).pipe(
    concatMap(arr => from(arr)),
    tap(arr => console.log('deleting: ' + JSON.stringify(arr))),
    map(file =>({file:file,createdAt: parseInt(path.basename(file,'.mp4'))})),
    filter(v => v.createdAt < ((new Date).getTime() -  60 * 60 * 2)),
    concatMap(e => removeFile(e.file))
)

const clearVideoStream = interval(60 * 60 * 1000).pipe(mergeMap(_ => resultStream))

exports.clearVideoStream = clearVideoStream