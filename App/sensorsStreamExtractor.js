const { Observable,of,merge,empty } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap} = require('rxjs/operators');
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
const doorOpenSensor = throttledReadingsStreams.pipe(filter(r => r.sensorId===1234),share(),tap(emi => console.log("door open")));
const movementSensor = throttledReadingsStreams.pipe(filter(r => r.sensorId===6789),share(),tap(emi => console.log("movement sensor")));

const beforeDoorStream = movementSensor.pipe(
    mergeMap(mr => doorOpenSensor.pipe(
            tap(emi => console.log("beforeDoorStream - after pipe()")),
            first(),
            tap(emi => console.log("beforeDoorStream - after first()")),
            map(dr => Object.assign({movementBefore:true}, dr)),
            tap(emi => console.log("beforeDoorStream - after map()")),
            timeoutWith(1000*10,empty()),
            tap(emi => console.log("beforeDoorStream - after timeoutWith()"))
            )
        )
)

const afterDoorStream = doorOpenSensor.pipe(
    mergeMap(dr => movementSensor.pipe(
            tap(emi => console.log("afterDoorStream - after pipe()")),
            first(),
            tap(emi => console.log("afterDoorStream - after first()")),
            mapTo(Object.assign({movementAfter:true,finished:true}, dr)),
            tap(emi => console.log("afterDoorStream - after mapTo()")),
            timeoutWith(1000*10,of(Object.assign({finished:true}, dr))),
            tap(emi => console.log("afterDoorStream - after timeoutWith()"))
        )
    )
)

const doorOpenStream = merge(beforeDoorStream,afterDoorStream).pipe(
    tap(emi => console.log("RESSSSS - after merge()")),
    groupBy(r => r.timestamp, stream => stream),
    tap(emi => console.log("RESSSSS - after groupBy()")),
    mergeMap(stream => stream.pipe( takeWhile(e => !e.finished,true),toArray())),
    tap(emi => console.log("RESSSSS - after mergeMap()")),
    map(([befDoor,afterDoor]) =>  Object.assign(befDoor, afterDoor)),
    tap(emi => console.log("RESSSSS - after map()")),
    tap(emi => console.log("")),
    tap(emi => console.log(""))
)



exports.sensorsReadingStream = doorOpenStream;
