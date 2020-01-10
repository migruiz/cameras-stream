'use strict';
var spawn = require('child_process').spawn;
const { Observable,of,from,empty} = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap,endWith,switchMapTo} = require('rxjs/operators');
const fs = require('fs');
const util = require('util');
const videosFolder = '/videos/'
const videosFolderTemp = `${videosFolder}movementTemp/`
const ffmpegFolder = '/ffmpeg/';

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
    map(event => Object.assign({durationSecs:Math.round(parseFloat(event.duration/1000))}, event)),
    map(event => Object.assign({joinedStartAtMilis:event.startedAt - event.videosStartTime}, event)),
    map(event => Object.assign({joinedStartAt:Math.round(parseFloat(event.joinedStartAtMilis/1000))}, event)),
    map(event => Object.assign({filesToJoinPath:`${videosFolderTemp}${event.startedAt}.txt`}, event)),
    map(event => Object.assign({joinedVideoPath:`${videosFolderTemp}${event.startedAt}_joined.mp4`}, event)),
    map(event => Object.assign({targetVideoPath:`${videosFolderTemp}${event.startedAt}.mp4`}, event)),
    map(event => Object.assign({filesToJoinContent:event.videos.map(v => `file ${v.fileName}`).join('\r\n')}, event)),
    mergeMap(v => writeFileStream(v.filesToJoinPath,v.filesToJoinContent).pipe(endWith(v))),    
    mergeMap(v => joinFilesStream(v.filesToJoinPath,v.joinedVideoPath).pipe(endWith(v))),
    mergeMap(v => ffmpegextractVideoStream(v.joinedStartAt, v.durationSecs, v.joinedVideoPath,v.targetVideoPath).pipe(endWith(v))),   
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

 function toHHMMSS(sec_num) {
  var hours   = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
  var seconds = sec_num - (hours * 3600) - (minutes * 60);

  if (hours   < 10) {hours   = "0"+hours;}
  if (minutes < 10) {minutes = "0"+minutes;}
  if (seconds < 10) {seconds = "0"+seconds;}
  return hours+':'+minutes+':'+seconds;
}

const ffmpegextractVideoStream = (startPosition,durationSecs,joinedVideoPath,targetVideoPath) => Observable.create(subscriber => {   
    const params = [
        '-y'
        , '-ss'
        , toHHMMSS(startPosition)
        , '-i'
        , joinedVideoPath
        , '-t'
        , toHHMMSS(durationSecs)
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
        console.log(JSON.stringify({startPosition,joinedVideoPath,targetVideoPath,code,signal,result,errorResult}))
        subscriber.error('ffmpegextractVideoStream error');
      } else if (signal) {
        console.log(JSON.stringify({startPosition,joinedVideoPath,targetVideoPath,code,signal,result,errorResult}))
        subscriber.error('ffmpegextractVideoStream error');
      } else {
        subscriber.complete();
      }     
    }); 
});


exports.extractMovementVideoStream = extractVideoStream