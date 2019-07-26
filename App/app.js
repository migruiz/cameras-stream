const { Observable,of,interval,timer,from,empty} = require('rxjs');
const { map,buffer,withLatestFrom,tap,share,last,expand,catchError,mergeMap,delay,mapTo,concatMap,switchMapTo,endWith,repeat,shareReplay,timeout} = require('rxjs/operators');
const { videoFileStream} = require('./ffmpegVideoExtractor.js');
const { videoSegmentStream } = require('./videoSegmentExtractor');
const { sensorsReadingStream } = require('./sensorsStreamExtractor');
const { extractVideoStream } = require('./sensorVideoExtractor');
const { emailStream } = require('./emailSender');
const { uploadVideoStream } = require('./uploadYoutube');
const { clearVideoStream } = require('./clearVideosStream');
var mqtt = require('./mqttCluster.js');
const fs = require('fs');
const util = require('util');



global.sensorReadingTopic = 'sensorReadingTopic';
global.restartCameraTopic="restartCameraTopic"
global.mtqqLocalPath = process.env.MQTTLOCAL;

const  ffmpegProcessStream = videoFileStream.pipe(repeat(-1),shareReplay(1))

ffmpegProcessStream.subscribe(c => console.log(c.pid))

clearVideoStream.subscribe();


async function triggerRestartCamera(){
    var mqttCluster=await mqtt.getClusterAsync()
    mqttCluster.publishData(restartCameraTopic,{})
}

const videoHandleStreamError = videoSegmentStream.pipe(
    catchError(error => of(error).pipe(
        tap(err => console.log("killing ffmpeg after error extracting videos",err)),
        withLatestFrom(ffmpegProcessStream),
        tap(([_, ffmpegProcess]) => ffmpegProcess.kill()),
        mergeMap(_ => videoHandleStreamError)
        )
    ),
    timeout(2 * 60 * 1000),
    catchError(error => of(error).pipe(
        tap(err => console.log("restarting cameras error extracting videos",err)),
        concatMap(_ => triggerRestartCamera()),
        mergeMap(_ => videoHandleStreamError)
        )
    )     
)  

const sharedvideoSegmentStream = videoHandleStreamError.pipe(share());
var combinedStream = sensorsReadingStream.pipe(
    buffer(sharedvideoSegmentStream),
    withLatestFrom(sharedvideoSegmentStream),
    mergeMap(([sensors, segment]) =>  from(sensors).pipe(map(sensor=>({sensor,segment})))),
    concatMap(v=> extractVideoStream(v).pipe(map(extractedVideoPath => Object.assign({extractedVideoPath},v)))),
    concatMap(v=> uploadVideoStream(v.extractedVideoPath).pipe(map(youtubeURL => Object.assign({youtubeURL},v)))),    
    //map(v => Object.assign({youtubeURL:'https://youtu.be/Nl4dVgaibEc'},v)),
    mergeMap(v=> emailStream(v))

)
combinedStream.subscribe();