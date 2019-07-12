
const { Observable} = require('rxjs');
const { mergeMap,filter,map,scan} = require('rxjs/operators');
const { videoFileStream} = require('./ffmpegVideoExtractor.js');
const { videoSegmentStream } = require('./videoSegmentExtractor');
const { sensorsReadingStream } = require('./sensorsStreamExtractor');

global.sensorReadingTopic = 'sensorReadingTopic';
global.mtqqLocalPath = process.env.MQTTLOCAL;

videoFileStream.subscribe();
videoSegmentStream.subscribe(v => console.log(v))
sensorsReadingStream.subscribe(reading => console.log(JSON.stringify(reading)));   