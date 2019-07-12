const { Observable,of,interval} = require('rxjs');
const { map,buffer,withLatestFrom,tap,share} = require('rxjs/operators');
const { videoFileStream} = require('./ffmpegVideoExtractor.js');
const { videoSegmentStream } = require('./videoSegmentExtractor');
const { sensorsReadingStream } = require('./sensorsStreamExtractor');

global.sensorReadingTopic = 'sensorReadingTopic';
global.mtqqLocalPath = process.env.MQTTLOCAL;

videoFileStream.subscribe();
//videoSegmentStream.subscribe(v => console.log(v))
//sensorsReadingStream.subscribe(reading => console.log(JSON.stringify(reading)));   

const sharedvideoSegmentStream = videoSegmentStream.pipe(share());

var combinedStream = sensorsReadingStream.pipe(
    buffer(sharedvideoSegmentStream),
    withLatestFrom(sharedvideoSegmentStream),
    map(([first, second]) => {
        return `First Source (5s): ${JSON.stringify(first)} Second Source (1s): ${JSON.stringify(second)}`;
    }) 
)
combinedStream.subscribe(v => console.log(v));