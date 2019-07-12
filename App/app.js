
const { Observable} = require('rxjs');
const { mergeMap,filter,map,scan} = require('rxjs/operators');
const { videoFileStream} = require('./ffmpegVideoExtractor.js');
const { videoSegmentStream } = require('./videoSegmentExtractor');


videoFileStream.subscribe();
videoSegmentStream.subscribe(v => console.log(v))