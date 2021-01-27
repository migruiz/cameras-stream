'use strict';
const { probeVideoInfo} = require('../ffprobeVideoDetailsExtractor');
const dateFormat = require('dateformat');
/**
 * Usage: node upload.js PATH_TO_VIDEO_FILE
 */
const spawn = require('child_process').spawn;
const fs = require('fs');
const util = require('util');
const path = require('path');
const { from,of, Observable,forkJoin,iif,throwError,defer,interval,empty } = require('rxjs');
const { groupBy,endWith,reduce,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap,catchError,concatMap,switchMapTo} = require('rxjs/operators');

const removeFile = path =>  from(util.promisify(fs.unlink)(path)).pipe(switchMapTo(empty()));

const readDirStream = path =>  from(util.promisify(fs.readdir)(path));
const videosFolder = 'D:\\movements\\videos\\'
const videosFolderProcessing = 'D:\\movements\\Processing\\'
const ffmpegFolder = 'D:\\ffmpeg\\';

const resultStream = videoPath =>   readDirStream(videoPath).pipe(
    tap(v=> console.log('JSON.stringify(v)')),
    concatMap(arr => from(arr)),
    map(dir =>({dir:dir,createdAt: parseInt(path.basename(dir,'.mp4'))})),    
    map(fi => Object.assign({videoFile:`${videosFolder}${fi.dir}\\${fi.dir}.mp4`}, fi)),    
    concatMap(fi => probeVideoInfo(fi.videoFile).pipe(map(kt => Object.assign({duration:parseFloat(kt.format.duration)}, fi)))),
    map(fi => Object.assign({winVideoFile:`'${fi.videoFile}'`}, fi)),
    map(fi => Object.assign({createdDate:new Date(fi.createdAt)}, fi)),
    map(fi => Object.assign({dateDay:fi.createdDate.getDate()}, fi)),
    groupBy(fi => fi.dateDay, r=>r),
    mergeMap(group$ =>
        group$.pipe(reduce((acc, cur) => [...acc, cur], [`${group$.key}`]))
      ),
      
    map(arr => ({ dateDay: parseInt(arr[0], 10), values: arr.slice(1) })),
    map(v => ({ dateDay: v.dateDay, values: v.values.reduce((acc,cur) => [...acc,Object.assign({relativeStartTimeSecs:acc.reduce((a,{duration}) => a+ duration,0)},cur)],[]) })),
    map(v => ({ dateDay: v.dateDay, values: v.values.map(inf => Object.assign({youtubeTime:getYoutubeTime(inf.relativeStartTimeSecs)},inf))})),
    map(event => Object.assign({youtubeDescription:event.values.map(v => `${v.youtubeTime} ${dateFormat(v.createdDate, "h:MM TT, dddd mmmm dS")}`).join('\r\n')}, event)),
    map(event => Object.assign({youtubeTitle: `${dateFormat(event.values[0].createdDate, "h:MM TT, dddd mmmm dS")} to ${dateFormat(event.values[event.values.length-1].createdDate, "h:MM TT, dddd mmmm dS")}`},event)),
    tap(v=>         
        console.log(JSON.stringify(v))
    ),
    
    map(event => Object.assign({startTimeStamp:event.values[0].createdAt}, event)),
    map(event => Object.assign({processingSubFolder:`${videosFolderProcessing}${event.dateDay}\\`}, event)),
    map(event => Object.assign({filesToJoinPath:`${event.processingSubFolder}filesToJoin.txt`}, event)),
    map(event => Object.assign({joinedVideoPath:`${event.processingSubFolder}joined.mp4`}, event)),
    map(event => Object.assign({dayInfoPath:`${event.processingSubFolder}dayInfo.json`}, event)),
    map(event => Object.assign({filesToJoinContent:event.values.map(v => `file ${v.winVideoFile}`).join('\r\n')}, event)),
    
    concatMap(v => removeDirectoryStream(v.processingSubFolder).pipe(endWith(v))),
    concatMap(v => createSubFolder(v.processingSubFolder).pipe(endWith(v))),  
    concatMap(v => writeFileStream(v.filesToJoinPath,v.filesToJoinContent).pipe(endWith(v))),    
    concatMap(v => writeFileStream(v.dayInfoPath,JSON.stringify(v)).pipe(endWith(v))),    
    //concatMap(v => joinFilesStream(v.filesToJoinPath,v.joinedVideoPath).pipe(endWith(v))),


    
    //concatMap(e => removeFile(videosFolder + e.file))
)

const getYoutubeTime = deltaMiliSecs =>{
    const sec_num = Math.floor(deltaMiliSecs)
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);
  
    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+':'+minutes+':'+seconds;
}

const createSubFolder = path =>  from(util.promisify(fs.mkdir)(path)).pipe(switchMapTo(empty()));
const readfileStream = path =>  from(util.promisify(fs.readFile)(path));
const writeFileStream = (path,content) =>  Observable.create(subscriber => {  
    fs.writeFile(path, content, function (err) {
        if (err) {
            subscriber.error(err)
        }
        subscriber.complete();
    });
});
const removeDirectoryStream = path =>  Observable.create(subscriber => {  
    fs.rmdir(path,{ recursive: true } , function (err) {
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