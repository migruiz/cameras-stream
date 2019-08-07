const { Observable,throwError,timer,of} = require('rxjs');
const { mergeMap,filter,map,pairwise,timeout,startWith,concat,bufferCount} = require('rxjs/operators');
const { probeVideoInfo} = require('./ffprobeVideoDetailsExtractor');
const path = require('path');
var Inotify = require('inotify').Inotify;
var inotify = new Inotify();



const videosFolder = '/videos/'

const videoFilesStream = new Observable(subscriber => {  
    inotify.addWatch({
        path: videosFolder,
        watch_for: Inotify.IN_ALL_EVENTS,
        callback: event => subscriber.next(event)
    });
})
const segmentStream = videoFilesStream.pipe(
    filter(e => e.mask & Inotify.IN_CLOSE_WRITE),
    timeout(1 * 60 * 1000),
    map(e => e.name),
    mergeMap(fileName => probeVideoInfo(videosFolder + fileName)),
    mergeMap(videoInfo => videoInfo.format.duration < 20 ? throwError('Error length video '+ JSON.stringify(videoInfo)) : of(videoInfo)),
    map(videoInfo => (
        {
            fileName:videoInfo.format.filename,
            startTime:1000 * parseInt(path.basename(videoInfo.format.filename,'.mp4')),            
            length:1000 * Math.round(parseFloat(videoInfo.format.duration))
        }
    )),
    map(videoInfo => Object.assign({endTime:videoInfo.startTime+videoInfo.length}, videoInfo)),
    bufferCount(4,1),
    map ( ([first,second,third,forth]) => ({
        startTime:first.startTime,
        endTime:forth.endTime,
        filesToJoin: [first.fileName,second.fileName,third.fileName, forth.fileName]
    }))
)

exports.videoSegmentStream = segmentStream