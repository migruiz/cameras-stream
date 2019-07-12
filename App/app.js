
const { Observable} = require('rxjs');
const { mergeMap} = require('rxjs/operators');
const { videoFileStream} = require('./ffmpegVideoExtractor.js');
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
videoFilesStream.subscribe(v => console.log(v.mask))