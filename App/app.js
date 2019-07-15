const { Observable,of,interval} = require('rxjs');
const { map,buffer,withLatestFrom,tap,share,last,expand} = require('rxjs/operators');
const { videoFileStream} = require('./ffmpegVideoExtractor.js');
const { videoSegmentStream } = require('./videoSegmentExtractor');
const { sensorsReadingStream } = require('./sensorsStreamExtractor');

global.sensorReadingTopic = 'sensorReadingTopic';
global.mtqqLocalPath = process.env.MQTTLOCAL;

const  lastFfmpeg = videoFileStream.pipe(last())
const ffmpegStream = lastFfmpeg.pipe(expand(_ => lastFfmpeg));
ffmpegStream.subscribe();


const sharedvideoSegmentStream = videoSegmentStream.pipe(share());
var combinedStream = sensorsReadingStream.pipe(
    buffer(sharedvideoSegmentStream),
    withLatestFrom(sharedvideoSegmentStream),
    map(([sensors, segment]) => {
        return `Sensors ${JSON.stringify(sensors)} Segment: ${JSON.stringify(segment)}`;
    }) 
)
combinedStream.subscribe();