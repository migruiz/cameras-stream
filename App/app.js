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

const  ffmpegProcessStream = videoFileStream.pipe(repeat(),delay(500),shareReplay(1))

ffmpegProcessStream.subscribe();

clearVideoStream.subscribe();


async function triggerRestartCamera(){
    var mqttCluster=await mqtt.getClusterAsync()
    mqttCluster.publishData(restartCameraTopic,{})
}

const videoHandleStreamErrorFFMPEG = videoSegmentStream.pipe(    
    timeout(1 * 60 * 1000),
    catchError(error => of(error).pipe(
        tap(err => console.log("killing ffmpeg after error extracting videos",err)),
        withLatestFrom(ffmpegProcessStream),
        tap(([_, ffmpegProcess]) => ffmpegProcess.kill()),
        mergeMap(_ => videoHandleStreamErrorFFMPEG)
        )
    ),
    share()   
)  
const videoHandleStreamError = videoHandleStreamErrorFFMPEG.pipe(    
    timeout(5 * 60 * 1000),
    catchError(error => of(error).pipe(
        tap(err => console.log("restarting cameras error extracting videos",err)),
        concatMap(err => from(triggerRestartCamera()).pipe(last(),endWith(err))),
        tap(err => console.log(" after restarting cameras error extracting videos",err)),
        mergeMap(_ => videoHandleStreamError)
        )
    ),
    share()  
)  

var combinedStream = sensorsReadingStream.pipe(
    buffer(videoHandleStreamError),
    withLatestFrom(videoHandleStreamError),
    mergeMap(([sensors, segment]) =>  from(sensors).pipe(map(sensor=>({sensor,segment})))),
    concatMap(v=> extractVideoStream(v).pipe(map(extractedVideoPath => Object.assign({extractedVideoPath},v)))),
    //concatMap(v=> uploadVideoStream(v.extractedVideoPath).pipe(map(youtubeURL => Object.assign({youtubeURL},v)))),    
    map(v => Object.assign({youtubeURL:'https://youtu.be/Nl4dVgaibEc'},v)),
    mergeMap(v=> emailStream(v))

)
combinedStream.subscribe();