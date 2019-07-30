const { Observable,of,interval,timer,from,empty} = require('rxjs');
const { map,buffer,withLatestFrom,tap,share,last,expand,catchError,mergeMap,delay,mapTo,concatMap,switchMapTo,endWith,repeat,shareReplay,timeout,first} = require('rxjs/operators');
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
        tap(err => console.log("restarting cameras error extracting videos",err)),
        concatMap(err => from(triggerRestartCamera()).pipe(last(),mapTo(err))),
        tap(err => console.log(" after restarting cameras error extracting videos",err)),
        mergeMap(_ => videoHandleStreamError)
        )
    )
)  
var sharedvideoInfo = videoHandleStreamError.pipe(shareReplay(1))
sharedvideoInfo.subscribe( c => console.log(JSON.stringify(c)))

var combinedStream = sensorsReadingStream.pipe(
    mergeMap(sensor => sharedvideoInfo.pipe(
        tap(sensor =>  console.log(JSON.stringify(sensor))),
        first(segment => segment.startTime < sensor.startVideoAt && sensor.endVideoAt < segment.endTime),
        map(segment => {sensor,segment})
        )),
    concatMap(v=> extractVideoStream(v).pipe(map(extractedVideoPath => Object.assign({extractedVideoPath},v)))),
    concatMap(v=> uploadVideoStream(v).pipe(map(youtubeURL => Object.assign({youtubeURL},v)))),    
    //map(v => Object.assign({youtubeURL:'https://youtu.be/Nl4dVgaibEc'},v)),
    mergeMap(v => removeFile(v.extractedVideoPath).pipe(endWith(v))),
    mergeMap(v=> emailStream(v)),
    tap(_ => console.log("email sent"))

)
combinedStream.subscribe();