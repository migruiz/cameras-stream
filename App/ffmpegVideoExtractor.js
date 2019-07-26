'use strict';
var spawn = require('child_process').spawn;
const { Observable} = require('rxjs');

const videosFolder = '/videos/'
const ffmpegFolder = '/ffmpeg/';

const videoFileStream = Observable.create(subscriber => {   
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
        if (code) {
            //console.error('ffmpeg exited with code', code)
          } else if (signal) {
            //console.error('ffmpeg was killed with signal', signal);
          } else {
            //console.log('ffmpeg exited okay');
          }
        subscriber.complete()
    });    
    subscriber.next(ffmpegChild) 
});


exports.videoFileStream = videoFileStream