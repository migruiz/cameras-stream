'use strict';
var spawn = require('child_process').spawn;
const { Observable} = require('rxjs');

const videosFolder = '/videos/'
const ffmpegFolder = '/ffmpeg/';

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
    ffmpegChild.stdout.on('data', (data) => {
        console.log(data);
    });
    ffmpegChild.stderr.on('data', (data) => {
        console.error(`child stderr:\n${data}`);
    });
    ffmpegChild.on('exit', function (code, signal) {
        console.log("terminated");
        subscriber.complete()
    });    
    console.log("extracting files");
});


exports.videoFileStream = videoFileStream