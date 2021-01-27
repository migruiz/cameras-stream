'use strict';

/**
 * Usage: node upload.js PATH_TO_VIDEO_FILE
 */

const fs = require('fs');
const util = require('util');
const path = require('path');
const { from,of, Observable,forkJoin,iif,throwError,defer,interval,empty } = require('rxjs');
const { groupBy,endWith,reduce,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap,catchError,concatMap,switchMapTo} = require('rxjs/operators');

const removeFile = path =>  from(util.promisify(fs.unlink)(path)).pipe(switchMapTo(empty()));
const readDirStream = path =>  from(util.promisify(fs.readdir)(path));
const videosFolder = 'D:\\movements\\videos\\'
const videosFolderProcessing = 'D:\\movements\\Processing\\'

const resultStream = videoPath =>   readDirStream(videoPath).pipe(
    tap(v=> console.log('JSON.stringify(v)')),
    concatMap(arr => from(arr)),
    map(dir =>({dir:dir,createdAt: parseInt(path.basename(dir,'.mp4'))})),
    map(fi => Object.assign({videoFile:`${videosFolder}${fi.dir}\\${fi.dir}.mp4`}, fi)),
    map(fi => Object.assign({createdDate:new Date(fi.createdAt)}, fi)),
    map(fi => Object.assign({dateDay:fi.createdDate.getDate()}, fi)),
    groupBy(fi => fi.dateDay, r=>r),
    mergeMap(group$ =>
        group$.pipe(reduce((acc, cur) => [...acc, cur], [`${group$.key}`]))
      ),
    map(arr => ({ dateDay: parseInt(arr[0], 10), values: arr.slice(1) })),

    map(event => Object.assign({processingSubFolder:`${videosFolderProcessing}${event.dateDay}\\`}, event)),
    map(event => Object.assign({filesToJoinPath:`${event.processingSubFolder}filesToJoin.txt`}, event)),
    map(event => Object.assign({joinedVideoPath:`${event.processingSubFolder}joined.mp4`}, event)),
    map(event => Object.assign({filesToJoinContent:event.values.map(v => `file ${v.videoFile}`).join('\r\n')}, event)),
    
    mergeMap(v => createSubFolder(v.processingSubFolder).pipe(endWith(v))),  
    mergeMap(v => writeFileStream(v.filesToJoinPath,v.filesToJoinContent).pipe(endWith(v))),    
    //mergeMap(v => joinFilesStream(v.filesToJoinPath,v.joinedVideoPath).pipe(endWith(v))),


    tap(v=> 
        console.log(JSON.stringify(v))
    )
    //concatMap(e => removeFile(videosFolder + e.file))
)
const createSubFolder = path =>  from(util.promisify(fs.mkdir)(path)).pipe(switchMapTo(empty()));
const writeFileStream = (path,content) =>  Observable.create(subscriber => {  
    fs.writeFile(path, content, function (err) {
        if (err) {
            subscriber.error(err)
        }
        subscriber.complete();
    });
});


const joinFilesStream = (filesToJoinPath,targetFile) => Observable.create(subscriber => {   
    const params=  [
        '-y'
        , '-f'
        , 'concat'
        , '-safe'
        , '0'
        , '-i'
        , filesToJoinPath
        , '-c'
        , 'copy'
        , targetFile
    ]
    const ffmpegChild = spawn(ffmpegFolder+'ffmpeg',params);
    var result = '';
    ffmpegChild.stdout.on('data', (data) => {
        result += data.toString();
    });
    var errorResult = '';
    ffmpegChild.stderr.on('data', (data) => {
      errorResult += data.toString();
    });
    ffmpegChild.on('exit', function (code, signal) {
      if (code) {
        console.log(JSON.stringify({filesToJoinPath,targetFile,code,signal,result,errorResult}))
        subscriber.error('joinFilesStream error');
      } else if (signal) {
        console.log(JSON.stringify({filesToJoinPath,targetFile,code,signal,result,errorResult}))
        subscriber.error('joinFilesStream error');
      } else {
        subscriber.complete();
      }     
    }); 
});


//const clearVideoStream = interval(5 * 1000).pipe(mergeMap(_ => resultStream(videosFolder)))
const clearVideoStream =  resultStream(videosFolder)

clearVideoStream.subscribe();

exports.clearVideoStream = clearVideoStream