
const { mergeMap} = require('rxjs/operators');
const { videoFileStream} = require('./ffmpegVideoExtractor.js');



const  videoExtractorStream = videoFileStream.pipe(mergeMap(v => videoExtractorStream))
videoExtractorStream.subscribe();

