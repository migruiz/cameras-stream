const { Observable,of,interval,timer,from,empty} = require('rxjs');
const { map,buffer,withLatestFrom,tap,share,last,expand,catchError,mergeMap,delay,mapTo,concatMap,switchMapTo,endWith,repeat,shareReplay,timeout,first,filter,merge,timeoutWith} = require('rxjs/operators');
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

const removeFile = path =>  from(util.promisify(fs.unlink)(path)).pipe(switchMapTo(empty()));

const  ffmpegProcessStream = videoFileStream.pipe(repeat(),delay(500),shareReplay(1))

ffmpegProcessStream.subscribe();

clearVideoStream.subscribe();


async function triggerRestartCamera(){
    var mqttCluster=await mqtt.getClusterAsync()
    mqttCluster.publishData(restartCameraTopic,{})
}

const videoHandleStreamErrorFFMPEG = videoSegmentStream.pipe(    
    timeout(2 * 60 * 1000),
    catchError(error => of(error).pipe(
        tap(err => console.log("killing ffmpeg after error extracting videos",err)),
        withLatestFrom(ffmpegProcessStream),
        tap(([_, ffmpegProcess]) => ffmpegProcess.kill()),
        mergeMap(_ => videoHandleStreamErrorFFMPEG)
        )
    ) 
)  
var sharedvideoHandleStreamErrorFFMPEG = videoHandleStreamErrorFFMPEG.pipe(share())
const videoHandleStreamError = sharedvideoHandleStreamErrorFFMPEG.pipe(    
    timeout(5 * 60 * 1000),
    catchError(error => of(error).pipe(
        concatMap(err => from(triggerRestartCamera()).pipe(last(),mapTo(err))),
        mergeMap(_ => videoHandleStreamError)
        )
    )
)  
const sharedvideoInfo = videoHandleStreamError.pipe(shareReplay(1))

const sensorSegmentStream = sensorsReadingStream.pipe(   
    tap(co => console.log("sensorSegmentStream",JSON.stringify(co))), 
    mergeMap(sensor => sharedvideoInfo.pipe(
        tap(co => console.log("sharedvideoInfo",JSON.stringify(co))), 
        first(segment => segment.startTime < sensor.startVideoAt && sensor.endVideoAt < segment.endTime),
        tap(co => console.log("first(segment",JSON.stringify(co))), 
        map(segment => ({sensor,segment})),
        tap(co => console.log("map(segment",JSON.stringify(co))), 
        timeout(60 * 1000),
        tap(co => console.log("timeout",JSON.stringify(co))), 
        mergeMap(p => extractVideo(p)),
        tap(co => console.log("mergeMap(p",JSON.stringify(co))), 
        catchError(error => of({sensor,error})),     
        tap(co => console.log("catchError",JSON.stringify(co))),    
        mergeMap(v=> emailStream(v)),
        tap(_ => console.log("email sent"))
    )   
    )
);

    


function extractVideo(v){
    return of(v).pipe(
        tap(co => console.log("of(v)",JSON.stringify(co))),   
    concatMap(v=> extractVideoStream(v).pipe(map(extractedVideoPath => Object.assign({extractedVideoPath},v)))),
    tap(co => console.log("concatMap(v=> extractVideoStream",JSON.stringify(co))),   
    concatMap(v=> uploadVideoStream(v).pipe(map(youtubeURL => Object.assign({youtubeURL},v)))),    
    tap(co => console.log("concatMap(v=> uploadVideoStream(v)",JSON.stringify(co))),   
    //map(v => Object.assign({youtubeURL:'https://youtu.be/Nl4dVgaibEc'},v)),
    mergeMap(v => removeFile(v.extractedVideoPath).pipe(endWith(v))),
    tap(co => console.log("mergeMap(v => removeFile",JSON.stringify(co))),   
    )
}


sensorSegmentStream.subscribe();