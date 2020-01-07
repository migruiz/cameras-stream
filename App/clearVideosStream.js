'use strict';

/**
 * Usage: node upload.js PATH_TO_VIDEO_FILE
 */

const fs = require('fs');
const util = require('util');
const path = require('path');
const { from,of,Observable,forkJoin,iif,throwError,defer,interval,empty } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap,catchError,concatMap,switchMapTo} = require('rxjs/operators');

const removeFile = path =>  from(util.promisify(fs.unlink)(path)).pipe(switchMapTo(empty()));
const readDirStream = path =>  from(util.promisify(fs.readdir)(path));
const videosFolder = '/videos/'

const resultStream = videoPath =>   readDirStream(videoPath).pipe(
    concatMap(arr => from(arr)),
    map(file =>({file:file,createdAt: 1000 * parseInt(path.basename(file,'.mp4'))})),
    filter(v => v && v.createdAt < (new Date).getTime() - 5 * 60 * 1000),
    concatMap(e => removeFile(videosFolder + e.file))
)

const clearVideoStream = interval(5  * 60 * 1000).pipe(mergeMap(_ => resultStream(videosFolder)))

exports.clearVideoStream = clearVideoStream