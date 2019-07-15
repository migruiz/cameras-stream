const { Observable,of,merge,empty } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap} = require('rxjs/operators');
var mqtt = require('./mqttCluster.js');
const path = require('path');
const VIDEOSEGMENTLENGTH=30*1000;
const sensorsReadingStream = new Observable(async subscriber => {  
    console.log('subscribing sensorsReadingStream')
    var mqttCluster=await mqtt.getClusterAsync()   
    mqttCluster.subscribeData(global.sensorReadingTopic, function(content){
        subscriber.next(content)
    });
});


const throttledReadingsStreams = sensorsReadingStream.pipe(
    map(r => ({
        sensorId: parseInt(r.data),
        timestamp: (new Date).getTime(),                
    })),
    groupBy(r => r.sensorId, r => r),    
    mergeMap(s => s.pipe(throttleTime(4000))),
    share(),
    tap(v => console.log(v))        
)
const doorOpenSensor = throttledReadingsStreams.pipe(filter(r => r.sensorId===1234),share());
const movementSensor = throttledReadingsStreams.pipe(filter(r => r.sensorId===6789),share());

const beforeDoorStream = movementSensor.pipe(
    mergeMap(mr => doorOpenSensor.pipe(
            first(),
            map(dr => Object.assign({movementBefore:true}, dr)),
            timeoutWith(1000*10,empty())
            )
        )
)

const afterDoorStream = doorOpenSensor.pipe(
    mergeMap(dr => movementSensor.pipe(
            first(),
            mapTo(Object.assign({movementAfter:true,finished:true, finishTime:(new Date).getTime()}, dr)),
            timeoutWith(1000*10,of(Object.assign({finished:true, finishTime:(new Date).getTime()}, dr)))
        )
    )
)

var doorOpenStream = merge(beforeDoorStream,afterDoorStream).pipe(
    groupBy(r => r.timestamp, stream => stream),
    mergeMap(stream => stream.pipe( takeWhile(e => !e.finished,true),toArray())),
    map(([befDoor,afterDoor]) =>  Object.assign(befDoor, afterDoor))
)

doorOpenStream = doorOpenStream.pipe(
    map( e => Object.assign({endVideoAt:getEndTime(e)}, e)),
    map( e => Object.assign({delayFor:getDelay(e.endVideoAt)}, e)),
    tap( e => console.log(e)),
    mergeMap(e => of(e).pipe(delay(e.delayFor))),
    tap( e => console.log("emiited"))

)

function getDelay(endVideoAt){
    const currentTime = (new Date).getTime();
    if (currentTime > endVideoAt)
        return 0;
    return endVideoAt - currentTime;
}
function getEndTime(e){
    if (!e.movementBefore && !e.movementAfter){
        return e.timestamp + VIDEOSEGMENTLENGTH/2;
    }
    else if (e.movementBefore && e.movementAfter){
        return e.timestamp + VIDEOSEGMENTLENGTH/2;
    }
    else if (e.movementBefore && !e.movementAfter){
        return e.timestamp + 3*1000;
    }
    else if (!e.movementBefore && e.movementAfter){
        return e.timestamp + VIDEOSEGMENTLENGTH - 3*1000
    }
}


exports.sensorsReadingStream = doorOpenStream;
