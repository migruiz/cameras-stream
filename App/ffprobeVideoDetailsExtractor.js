'use strict';
var spawn = require('child_process').spawn;
const { Observable} = require('rxjs');
const ffmpegFolder = '/ffmpeg/';

const probeVideoInfo= function(videoPath){
    return new Observable(subscriber => {  
        const ffprobe = spawn(ffmpegFolder+'ffprobe'
        , [
            '-v'
            , 'quiet'
            , '-print_format'
            , 'json'
            , '-show_format'
            , '-show_streams'
            , videoPath
        ]);

        var result = '';
        ffprobe.stdout.on('data', (data) => {
            result += data.toString();
        });
        ffprobe.stderr.on('data', (data) => {
            console.error(`child stderr:\n${data}`);
        });
        ffprobe.on('exit', function (code, signal) {
            var info = JSON.parse(result);
            subscriber.next(info);
            subscriber.complete();
        });
    });
}


exports.probeVideoInfo = probeVideoInfo