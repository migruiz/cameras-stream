const { Observable,of,merge,empty,interval } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,timeout,shareReplay,ignoreElements,debounceTime, toArray,takeWhile,delay,tap,distinct,bufferWhen} = require('rxjs/operators');
var mqtt = require('../mqttCluster.js');
const movementSensorsReadingStream = new Observable(async subscriber => {  
    var mqttCluster=await mqtt.getClusterAsync()   
    mqttCluster.subscribeData('Eurodomest', function(content){
        if (content.ID==='206aae' || content.ID==='006aae'){
            subscriber.next({data:'16340250'})
        }
    });
    mqttCluster.subscribeData('EV1527', function(content){
        if (content.ID==='04f0f4' || content.ID==='0f9551'){
            subscriber.next({data:'233945'})
        }
    });
});



const { probeVideoInfo} = require('../ffprobeVideoDetailsExtractor');
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
    shareReplay(10)
)
segmentStream.subscribe()

var movementSharedStream = movementSensorsReadingStream.pipe(
    map(_ => (new Date).getTime())
    ,share()
    )

 var streamToListen =   movementSharedStream.pipe(
    bufferWhen(
        () => movementSharedStream.pipe(debounceTime(20000))
    )
    ,map(a=> ({startedAt:a[0],endedAt:a[a.length-1]}))    
    ,map(a => Object.assign({duration:a.endedAt - a.startedAt},a))
    ,map(a => Object.assign({timestamp:a.startedAt},a))
    ,filter(a => a.duration>2000)
    ,map(a => Object.assign({startVideoAt:a.startedAt - 3000, endVideoAt:a.endedAt + 3000},a))
    ,map(a => Object.assign({videoDuration:a.endVideoAt - a.startVideoAt},a))
    ,mergeMap( ev =>         
        segmentStream.pipe(
            filter(s=>s.endTime > ev.startVideoAt)
            ,takeWhile(s=> s.startTime < ev.endVideoAt )
            ,toArray()
            ,map(a => Object.assign({videos:a, videosStartTime:a[0].startTime, videosEndTime:a[a.length-1].endTime},ev))
        )
    )
)

exports.movementStream = streamToListen



