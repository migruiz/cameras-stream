const { Observable,of,interval,timer,from,empty} = require('rxjs');
const { map,buffer,withLatestFrom,tap,share,last,expand,catchError,mergeMap,delay,mapTo,concatMap,switchMapTo,endWith} = require('rxjs/operators');
const { videoFileStream} = require('./ffmpegVideoExtractor.js');
const { videoSegmentStream } = require('./videoSegmentExtractor');
const { sensorsReadingStream } = require('./sensorsStreamExtractor');
const { extractVideoStream } = require('./sensorVideoExtractor');
const { emailStream } = require('./emailSender');
const { uploadVideoStream } = require('./uploadYoutube');
const { clearVideoStream } = require('./clearVideosStream');

const fs = require('fs');
const util = require('util');

const removeFile = path =>  from(util.promisify(fs.unlink)(path)).pipe(switchMapTo(empty()));

global.sensorReadingTopic = 'sensorReadingTopic';
global.mtqqLocalPath = process.env.MQTTLOCAL;

const  lastFfmpeg = videoFileStream.pipe(last())
lastFfmpeg.pipe(expand(_ => lastFfmpeg)).subscribe();

clearVideoStream.subscribe();




var videoHandleStreamError = videoSegmentStream.pipe(
    catchError(error => timer(60*1000).pipe(
        map(_ => console.log("restartong camera")),
        delay(40*1000),
        tap(_ => console.log("listeng again")),
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