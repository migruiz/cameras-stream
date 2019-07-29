'use strict';
var spawn = require('child_process').spawn;
const { Observable} = require('rxjs');

const videosFolder = '/videos/'
const ffmpegFolder = '/ffmpeg/';

const videoFileStream = Observable.create(subscriber => {   
    var ffmpegChild = spawn(ffmpegFolder+'ffmpeg'
    , [
         '-i'
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
        console.log(JSON.stringify({code,signal,result,errorResult}))
        subscriber.error('ffmpeg videoFileStream error');
      } else if (signal) {
        console.log(JSON.stringify({code,signal,result,errorResult}))
        subscriber.error('ffmpeg videoFileStream  error');
      } else {
        subscriber.complete();
      }     
    }); 
    subscriber.next(ffmpegChild)   
    
});


exports.videoFileStream = videoFileStream