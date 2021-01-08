'use strict';
var spawn = require('child_process').spawn;
const { Observable} = require('rxjs');
const { retry } = require('rxjs/operators');
const ffmpegFolder = '/ffmpeg/';

const probeVideoInfo= function(videoPath){
    var infoObservable = new Observable(subscriber => {          
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
            
            try {
                var info = JSON.parse(result);
                subscriber.next(info);
                subscriber.complete();
            } catch (error) {
                console.log('ffprobe',videoPath)   
                console.log(JSON.stringify({code,signal,result}))
                throw error;
            }

        });
    });
    return infoObservable.pipe(
        retry(4)
    )
}


exports.probeVideoInfo = probeVideoInfo