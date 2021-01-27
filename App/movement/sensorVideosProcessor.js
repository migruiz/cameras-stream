'use strict';

/**
 * Usage: node upload.js PATH_TO_VIDEO_FILE
 */

const fs = require('fs');
const util = require('util');
const path = require('path');
const { from,of,Observable,forkJoin,iif,throwError,defer,interval,empty } = require('rxjs');
const { groupBy,reduce,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap,catchError,concatMap,switchMapTo} = require('rxjs/operators');

const removeFile = path =>  from(util.promisify(fs.unlink)(path)).pipe(switchMapTo(empty()));
const readDirStream = path =>  from(util.promisify(fs.readdir)(path));
const videosFolder = 'D:\\movements\\'

const resultStream = videoPath =>   readDirStream(videoPath).pipe(
    tap(v=> console.log('JSON.stringify(v)')),
    concatMap(arr => from(arr)),
    map(dir =>({dir:dir,createdAt: parseInt(path.basename(dir,'.mp4'))})),
    map(fi => Object.assign({videoFile:`${videosFolder}${fi.dir}\\${fi.dir}.mp4`}, fi)),
    map(fi => Object.assign({createdDate:new Date(fi.createdAt)}, fi)),
    map(fi => Object.assign({dateDay:fi.createdDate.getDate()}, fi)),
    groupBy(fi => fi.dateDay, r=>r),
    mergeMap(group$ => group$.pipe(toArray())),
    tap(v=> 
        console.log(JSON.stringify(v))
    )
    //concatMap(e => removeFile(videosFolder + e.file))
)

//const clearVideoStream = interval(5 * 1000).pipe(mergeMap(_ => resultStream(videosFolder)))
const clearVideoStream =  resultStream(videosFolder)

clearVideoStream.subscribe();

exports.clearVideoStream = clearVideoStream