'use strict';
var spawn = require('child_process').spawn;
const { Observable,of,from,empty} = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap,endWith,switchMapTo} = require('rxjs/operators');
const fs = require('fs');
const util = require('util');
const videosFolder = '/videos/'
const videosFolderTemp = `${videosFolder}temp/`
const ffmpegFolder = '/ffmpeg/';
const VIDEOLENGTHSECS = 30;
const VIDEOLENGTH = VIDEOLENGTHSECS * 1000;

const removeFile = path =>  from(util.promisify(fs.unlink)(path)).pipe(switchMapTo(empty()));

const writeFileStream = (path,content) =>  Observable.create(subscriber => {  
    fs.writeFile(path, content, function (err) {
        if (err) {
            subscriber.error(err)
        }
        subscriber.complete();
    });
});



const extractVideoStream = sensorEvent =>
of(sensorEvent).pipe(
    map(event => Object.assign({joinedStartAtMilis:event.sensor.endVideoAt -event.segment.startTime  - VIDEOLENGTH}, event)),
    map(event => Object.assign({joinedStartAt:Math.round(parseFloat(event.joinedStartAtMilis/1000))}, event)),
    map(event => Object.assign({filesToJoinPath:`${videosFolderTemp}${event.sensor.timestamp}.txt`}, event)),
    map(event => Object.assign({joinedVideoPath:`${videosFolderTemp}${event.sensor.timestamp}_joined.mp4`}, event)),
    map(event => Object.assign({targetVideoPath:`${videosFolderTemp}${event.sensor.timestamp}.mp4`}, event)),
    map(event => Object.assign({filesToJoinContent:event.segment.filesToJoin.map(v => `file ${v}`).join('\r\n')}, event)),
    mergeMap(v => writeFileStream(v.filesToJoinPath,v.filesToJoinContent).pipe(endWith(v))),    
    mergeMap(v => joinFilesStream(v.filesToJoinPath,v.joinedVideoPath).pipe(endWith(v))),
    mergeMap(v => ffmpegextractVideoStream(v.joinedStartAt,v.joinedVideoPath,v.targetVideoPath).pipe(endWith(v))),
    mergeMap(v => removeFile(v.filesToJoinPath).pipe(endWith(v))),
    mergeMap(v => removeFile(v.joinedVideoPath).pipe(endWith(v))),
    map(event => event.targetVideoPath),
);


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

const ffmpegextractVideoStream = (startPosition,joinedVideoPath,targetVideoPath) => Observable.create(subscriber => {   
    const params = [
        '-y'
        , '-ss'
        , '00:00:' + ("0" + startPosition).slice(-2)
        , '-i'
        , joinedVideoPath
        , '-t'
        , '00:00:' + ("0" + VIDEOLENGTHSECS).slice(-2)
        , '-vcodec'
        , 'copy'
        , '-acodec'
        , 'copy'
        , targetVideoPath
    ];
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


exports.extractVideoStream = extractVideoStream