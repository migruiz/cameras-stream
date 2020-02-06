const { Observable,of,merge,empty,timer } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,reduce,takeUntil, share,shareReplay, filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap,distinct} = require('rxjs/operators');
var mqtt = require('./mqttCluster.js');
const VIDEOSEGMENTLENGTH=30*1000;
const WAITTIMEFORMOVEMENTAFTEROPENINGDOOR=15*1000;
const WAITTIMEFOROPENINGDOOR = 30*1000

global.mtqqLocalPath = 'mqtt://piscos.tk'

const sensorsReadingStream = new Observable(async subscriber => {  
    console.log('subscribing sensorsReadingStream')
    var mqttCluster=await mqtt.getClusterAsync()   
    mqttCluster.subscribeData('test', function(content){
        if (content.ID==='move'){
            subscriber.next({data:'16340250'})
        }
    });
    mqttCluster.subscribeData('test', function(content){
        if (content.ID==='door'){
            subscriber.next({data:'233945'})
        }
    });
});

const ESPDELAY = 3000

const sharedStream = sensorsReadingStream.pipe(
        map(r => ({
                sensorId: parseInt(r.data),
                timestamp: (new Date).getTime(),                
            })),
        share()
    )


const doorOpenSensor = sharedStream.pipe(
    filter(r => r.sensorId===233945),
    throttleTime(5000),
    map(r=>({sensorId:r.sensorId, timestamp:r.timestamp - ESPDELAY})),
    share()
    );
const outsideMovementSensor = sharedStream.pipe(filter(r => r.sensorId===16340250),share());

const movementBeforeDoorEvent = outsideMovementSensor.pipe(shareReplay(undefined,20000 + ESPDELAY,undefined))
const movementAfterDoorEvent = outsideMovementSensor.pipe(shareReplay(undefined,ESPDELAY,undefined))
movementBeforeDoorEvent.subscribe()
movementAfterDoorEvent.subscribe()


const beforeDoorEventStream = doorOpenSensor.pipe(
    mergeMap(d => movementBeforeDoorEvent.pipe(        
        timeoutWith(0,empty()),   
        takeWhile(s=> s.timestamp < d.timestamp),
        reduce((acc, _ ) => acc + 1, 0),
        map(n => Object.assign({countBefore:n,finished:false}, d))
        )
    )
)
const afterDoorEventStream = doorOpenSensor.pipe(
    
    mergeMap(d => movementAfterDoorEvent.pipe(     
        takeUntil(timer(20000 - ESPDELAY)),        
        reduce((acc, _ ) => acc + 1, 0),
        map(n => Object.assign({countAfter:n,finished:true}, d))
        )
    )
)

const result = merge(beforeDoorEventStream,afterDoorEventStream).pipe(
    groupBy(r => r.timestamp, r => r),
    mergeMap(stream => stream.pipe( takeWhile(e => !e.finished,true),toArray())),
    map(([befDoor,afterDoor]) =>  Object.assign(befDoor, afterDoor))
)
result.subscribe(c=> console.log(c))

return

const movementBeforeOpeningDoorStream = outsideMovementSensor.pipe(
    mergeMap(_ => doorOpenSensor.pipe(
            first(),
            map(dr => Object.assign({movementBefore:true}, dr)),
            timeoutWith(WAITTIMEFOROPENINGDOOR,empty())
            )
        ),
        distinct(dr =>dr.timestamp)
)

const movementAfterOpeningDoorStream = doorOpenSensor.pipe(
    mergeMap(dr => outsideMovementSensor.pipe(
            first(),
            mapTo(Object.assign({movementAfter:true,finished:true, finishTime:(new Date).getTime()}, dr)),
            timeoutWith(WAITTIMEFORMOVEMENTAFTEROPENINGDOOR,of(Object.assign({finished:true, finishTime:(new Date).getTime()}, dr)))
        )
    )
)

var doorOpenStream = merge(movementBeforeOpeningDoorStream,movementAfterOpeningDoorStream).pipe(
    groupBy(r => r.timestamp, stream => stream),
    mergeMap(stream => stream.pipe( takeWhile(e => !e.finished,true),toArray())),
    map(([befDoor,afterDoor]) =>  Object.assign(befDoor, afterDoor))
)

doorOpenStream = doorOpenStream.pipe(
    map( e => Object.assign({type:getEventType(e)}, e)),
    map( e => Object.assign({endVideoAt:getEndTime(e)}, e)),
    map( e => Object.assign({startVideoAt: e.endVideoAt - VIDEOSEGMENTLENGTH}, e)),
)


function getEventType(e){
    if (!e.movementBefore && !e.movementAfter){
        return 'NO_MOVEMENT'
    }
    else if (e.movementBefore && e.movementAfter){
        return 'MOVEMENT_BEFORE_AND_AFTER'
    }
    else if (e.movementBefore && !e.movementAfter){
        return 'ENTERING'
    }
    else if (!e.movementBefore && e.movementAfter){
        return 'EXITING'
    }
}


function getEndTime(e){
    switch(e.type) {
        case 'NO_MOVEMENT':
            return e.timestamp + VIDEOSEGMENTLENGTH/2;          
        case 'MOVEMENT_BEFORE_AND_AFTER':
            return e.timestamp + VIDEOSEGMENTLENGTH/2;
        case 'ENTERING':        
            return e.timestamp + 3*1000;
        case 'EXITING':
            return e.timestamp + VIDEOSEGMENTLENGTH - 3*1000
        default:
      }
}


exports.sensorsReadingStream = doorOpenStream;
