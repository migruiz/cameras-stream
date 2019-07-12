
const { Observable} = require('rxjs');
const { mergeMap,filter,map} = require('rxjs/operators');
const { videoFileStream} = require('./ffmpegVideoExtractor.js');
const { probeVideoInfo} = require('./ffprobeVideoDetailsExtractor');
var Inotify = require('inotify').Inotify;
var inotify = new Inotify();


const  videoExtractorStream = videoFileStream.pipe(mergeMap(v => videoExtractorStream))
videoExtractorStream.subscribe();





const videosFolder = '/videos/'

const videoFilesStream = new Observable(subscriber => {      
    inotify.addWatch({
        path: videosFolder,
        watch_for: Inotify.IN_ALL_EVENTS,
        callback: event => subscriber.next(event)
    });
})
videoFilesStream.pipe(
    filter(e => e.mask & Inotify.IN_CLOSE_WRITE),
    map(e => e.name),
    mergeMap(fileName => probeVideoInfo(videosFolder + fileName))
)
.subscribe(v => console.log(v))