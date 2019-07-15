const { Observable,of,interval} = require('rxjs');
const { map,buffer,withLatestFrom,tap,share,last,expand,catchError,mergeMap,delay,timer,mapTo} = require('rxjs/operators');
const { videoFileStream} = require('./ffmpegVideoExtractor.js');
const { videoSegmentStream } = require('./videoSegmentExtractor');
const { sensorsReadingStream } = require('./sensorsStreamExtractor');

global.sensorReadingTopic = 'sensorReadingTopic';
global.mtqqLocalPath = process.env.MQTTLOCAL;

const  lastFfmpeg = videoFileStream.pipe(last())
const ffmpegStream = lastFfmpeg.pipe(expand(_ => lastFfmpeg));
ffmpegStream.subscribe();


var videoHandleStreamError = videoSegmentStream.pipe(
    catchError(error => timer(60*1000).pipe(
        map(_ => console.log("restartong camera")),
        delay(30*1000),
        mergeMap(_ => videoHandleStreamError)
        )
    )    
)  

const sharedvideoSegmentStream = videoHandleStreamError.pipe(share());
var combinedStream = sensorsReadingStream.pipe(
    buffer(sharedvideoSegmentStream),
    withLatestFrom(sharedvideoSegmentStream),
    map(([sensors, segment]) => {
        return `Sensors ${JSON.stringify(sensors)} Segment: ${JSON.stringify(segment)}`;
    }) 
)
combinedStream.subscribe();