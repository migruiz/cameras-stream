const { Observable,of,merge,empty,interval } = require('rxjs');
const { groupBy,mergeMap,throttle,map,share,filter,first,mapTo,timeoutWith,timeout,shareReplay,ignoreElements,debounceTime, toArray,takeWhile,delay,tap,distinct,bufferWhen} = require('rxjs/operators');
var mqtt = require('../mqttCluster.js');

const movementSensorsReadingStream = new Observable(async subscriber => {  
    var mqttCluster=await mqtt.getClusterAsync()   
    mqttCluster.subscribeData('EV1527', function(content){
        if ((content.ID==='001c4e' && content.SWITCH==='03') || content.ID==='0ce052'){
            console.log(content.ID);
            subscriber.next({timestamp: (new Date).getTime()})
        }
    });
});

const sharedSensorStream = movementSensorsReadingStream.pipe(share())

const turnOffStream = sharedSensorStream.pipe(
    debounceTime(10),
    mapTo({timestamp: (new Date).getTime(), eventType:"off"}),
    share()
    )

const turnOnStream = sharedSensorStream.pipe(
    throttle(_ => turnOffStream),
    map(timestamp => ({timestamp, eventType:"on"})),
)

const combinedStream = turnOnStream.pipe(
    mergeMap(on => turnOffStream.pipe(
        first(),
        map(off => ({start:on.timestamp, end:off.timestamp}))
    )),
)



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


 var streamToListen =   combinedStream.pipe(
    mergeMap( ev =>         
        segmentStream.pipe(
            filter(s=>s.endTime > ev.startVideoAt)
            ,takeWhile(s=> s.startTime < ev.endVideoAt )
            ,toArray()
            ,map(a => Object.assign({videos:a, videosStartTime:a[0].startTime, videosEndTime:a[a.length-1].endTime},ev))
        )
    )
)



exports.movementStream = streamToListen



