'use strict';
var spawn = require('child_process').spawn;
const { Observable} = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap} = require('rxjs/operators');
const fs = require('fs');
const util = require('util');
const videosFolder = '/videos/'
const videosFolderTemp = `${videosFolder}temp/`
const ffmpegFolder = '/ffmpeg/';
const VIDEOLENGTH = 30;

const writeFileStream = (path,content) =>  Observable.create(subscriber => {  
    fs.writeFile(path, content, function (err) {
        if (err) subscriber.err(err)
        subscriber.complete();
    });
});



const extractVideoStream = sensorEvent =>
of(sensorEvent).pipe(
    map(event => Object.assign({joinedStartAtMilis:event.segment.endTime - event.sensor.endVideoAt - VIDEOLENGTH * 1000}, event)),
    map(event => Object.assign({joinedStartAt:Math.round(parseFloat(event.joinedStartAtMilis/1000))}, event)),
    map(event => Object.assign({filesToJoinPath:`${videosFolderTemp}${event.sensor.timestamp}.txt`}, event)),
    map(event => Object.assign({joinedVideoPath:`${videosFolderTemp}${event.sensor.timestamp}_joined.mp4`}, event)),
    map(event => Object.assign({targetVideoPath:`${videosFolderTemp}${event.sensor.timestamp}.mp4`}, event)),
    map(event => Object.assign({filesToJoinContent:event.segment.filesToJoin.map(v => `file ${v}`).join('\r\n')}, event)),
    tap(v=> console.log(v=> JSON.stringify(v))),
    map(event => event.targetVideoPath)
    //mergeMap(v => writeFileStream(v.filesToJoinPath,v.filesToJoinContent)),
    //mergeMap(v => joinFilesStream(v.filesToJoinPath,v.joinedVideoPath)),
    //mergeMap(v => extractVideoStream(v.joinedStartAt,v.joinedVideoPath,v.targetVideoPath)),
);


const joinFilesStream = (filesToJoinPath,targetFile) => Observable.create(subscriber => {   
    var ffmpegChild = spawn(ffmpegFolder+'ffmpeg'
    , [
        '-y'
        , '-f'
        , 'concat '
        , '-safe'
        , '0'
        , '-i'
        , filesToJoinPath
        , '-c'
        , '-copy'
        , targetFile
    ]);
    ffmpegChild.on('exit', function (code, signal) {
        subscriber.complete()
    });    
});

const extractVideoStream = (startPosition,joinedVideoPath,targetVideoPath) => Observable.create(subscriber => {   
    var ffmpegChild = spawn(ffmpegFolder+'ffmpeg'
    , [
        '-y'
        , '-ss'
        , '00:00:'
        ,  ("0" + startPosition).slice(-2)
        , '-i'
        , joinedVideoPath
        , '-t'
        , '00:00:'
        ,  ("0" + VIDEOLENGTH).slice(-2)
        , '-vcodec'
        , '-copy'
        , '-acodec'
        , 'copy'
        , targetVideoPath
    ]);
    ffmpegChild.on('exit', function (code, signal) {
        subscriber.complete()
    });    
});


exports.extractVideoStream = extractVideoStream