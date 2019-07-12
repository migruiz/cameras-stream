'use strict';
var spawn = require('child_process').spawn;
//var Inotify = require('inotify').Inotify;
var mqtt = require('./mqttCluster.js');
//var inotify = new Inotify();
const { Observable,of,interval } = require('rxjs');
const { throttleTime,map,groupBy,mergeMap,scan,filter,delay,startWith,tap } = require('rxjs/operators');
var videosFolder = '/videos/'
var ffmpegFolder = '/ffmpeg/';



const videoFileStream = new Observable(subscriber => {  
        var ffmpegChild = spawn(ffmpegFolder+'ffmpeg'
        , [
            '-loglevel'
            , 'panic'
            , '-i'
            , process.env.ENTRANCECAMRTSP
            , '-pix_fmt'
            , '+'
            , '-c:v'
            , 'copy'
            , '-c:a'
            , 'aac'
            , '-strict'
            , 'experimental'
            , '-f'
            , 'segment'
            , '-strftime'
            , '1'
            , '-segment_time'
            , '30'
            , '-segment_format'
            , 'mp4'
            , videosFolder + '%s.mp4'
        ]);
        console.log("extracting files");
        ffmpegChild.stdout.on('data', (data) => {
            console.log(data);
        });
        ffmpegChild.stderr.on('data', (data) => {
            console.error(`child stderr:\n${data}`);
        });
        ffmpegChild.on('exit', function (code, signal) {
            subscriber.complete()
        });
});


const  videoExtractorStream = videoFileStream.pipe(mergeMap(v => videoExtractorStream))
videoExtractorStream.subscribe();

