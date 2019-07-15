const { Observable,of,merge } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,empty,toArray,takeWhile,delay} = require('rxjs/operators');
var mqtt = require('./mqttCluster.js');
const path = require('path');
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
    share()        
)
const doorOpenSensor = throttledReadingsStreams.pipe(filter(r => r.sensorId=1234));
const movementSensor = throttledReadingsStreams.pipe(filter(r => r.sensorId=6789));

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
            mapTo(Object.assign({movementAfter:true,finished:true}, dr)),
            timeoutWith(1000*10,of(Object.assign({finished:true}, dr)))
        )
    )
)

const doorOpenStream = merge(beforeDoorStream,afterDoorStream).pipe(
    groupBy(r => r.timestamp, stream => stream),
    mergeMap(stream => stream.pipe( takeWhile(e => !e.finished,true),toArray())),
    map(([befDoor,afterDoor]) =>  Object.assign(befDoor, afterDoor))
)



exports.sensorsReadingStream = doorOpenStream;
