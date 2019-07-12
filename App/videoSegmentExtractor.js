const { Observable} = require('rxjs');
const { mergeMap,filter,map,scan} = require('rxjs/operators');
const { probeVideoInfo} = require('./ffprobeVideoDetailsExtractor');
const path = require('path');
var Inotify = require('inotify').Inotify;
var inotify = new Inotify();



const videosFolder = '/videos/'

const videoFilesStream = new Observable(subscriber => {   
    console.log('subscribing videoFilesStream')   
    inotify.addWatch({
        path: videosFolder,
        watch_for: Inotify.IN_ALL_EVENTS,
        callback: event => subscriber.next(event)
    });
})
const segmentStream = videoFilesStream.pipe(
    filter(e => e.mask & Inotify.IN_CLOSE_WRITE),
    map(e => e.name),
    mergeMap(fileName => probeVideoInfo(videosFolder + fileName)),
    map(videoInfo => (
        {
            fileName:videoInfo.format.filename,
            startTime:parseInt(path.basename(videoInfo.format.filename,'.mp4')),            
            length:Math.round(parseFloat(videoInfo.format.duration))
        }
    )),
    map(videoInfo => Object.assign({endTime:videoInfo.startTime+videoInfo.length}, videoInfo)),
    scan((acc, curr) => (
        {
            previous:acc.current,
            current:curr,  
        }
    ), {}),
    filter( intervalInfo => intervalInfo.previous),
    map ( intervalInfo => ({
        startTime:intervalInfo.previous.startTime,
        endTime:intervalInfo.current.endTime,
        filesToJoin: [intervalInfo.previous.fileName, intervalInfo.current.fileName]
    }))
)

exports.videoSegmentStream = segmentStream