'use strict';
var spawn = require('child_process').spawn;
const { Observable} = require('rxjs');

const videosFolder = '/videos/'
const ffmpegFolder = '/ffmpeg/';

const videoFileStream = new Observable(subscriber => {  
    console.log('subscribing videoFileStream')   
    function spwanNewChild(){
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
        ffmpegChild.on('exit', function (code, signal) {
            console.log("terminated");
            spwanNewChild()
        });    
        subscriber.next(ffmpegChild) 
    }
    spwanNewChild();
});


exports.videoFileStream = videoFileStream