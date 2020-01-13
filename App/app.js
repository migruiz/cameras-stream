const { Observable,of,interval,timer,from,empty} = require('rxjs');
const { map,buffer,withLatestFrom,tap,share,last,expand,catchError,mergeMap,delay,mapTo,concatMap,switchMapTo,endWith,repeat,shareReplay,timeout,first,filter,merge,timeoutWith,take,toArray,zip} = require('rxjs/operators');



const { videoFileStream} = require('./ffmpegVideoExtractor.js');
const { videoSegmentStream } = require('./videoSegmentExtractor');
const { sensorsReadingStream } = require('./sensorsStreamExtractor');
const { extractVideoStream } = require('./sensorVideoExtractor');
const { emailStream } = require('./emailSender');
const { uploadVideoStream } = require('./uploadYoutube');
const { clearVideoStream } = require('./clearVideosStream');
const { movementStream  } = require('./movement/movementStream');



var mqtt = require('./mqttCluster.js');
const fs = require('fs');
const util = require('util');



global.sensorReadingTopic = 'sensorReadingTopic';
global.restartCameraTopic="restartCameraTopic"
global.mtqqLocalPath = process.env.MQTTLOCAL;

const removeFile = path =>  from(util.promisify(fs.unlink)(path)).pipe(switchMapTo(empty()));

const  ffmpegProcessStream = videoFileStream.pipe(repeat(),shareReplay(1))

ffmpegProcessStream.subscribe();

clearVideoStream.subscribe();


async function triggerRestartCamera(){
    var mqttCluster=await mqtt.getClusterAsync()
    mqttCluster.publishData(restartCameraTopic,{})
}

const videoHandleStreamErrorFFMPEG = videoSegmentStream.pipe(  
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
const sharedvideoInfo = videoHandleStreamError.pipe(shareReplay(6))
sharedvideoInfo.subscribe()

const sensorSegmentStream = sensorsReadingStream.pipe(   
    mergeMap(sensor => sharedvideoInfo.pipe(
        first(segment => segment.startTime <= sensor.startVideoAt && sensor.endVideoAt <= segment.endTime),        
        map(segment => ({sensor,segment})),
        timeout(3 * 60 * 1000),
        mergeMap(p => extractVideo(p)), 
        catchError(error => of({sensor,error}) ),        
        mergeMap(v=> emailStream(v)),
    )   
    )
);


function extractVideo(v){
    return of(v).pipe(
    concatMap(v=> extractVideoStream(v).pipe(map(extractedVideoPath => Object.assign({extractedVideoPath},v)))), 
    concatMap(v=> uploadVideoStream(v).pipe(map(youtubeURL => Object.assign({youtubeURL},v)))),   
    //map(v => Object.assign({youtubeURL:'https://youtu.be/Nl4dVgaibEc'},v)),
    mergeMap(v => removeFile(v.extractedVideoPath).pipe(endWith(v))),
    )
}


sensorSegmentStream.subscribe();
movementStream.subscribe( d => console.log(JSON.stringify(d)))