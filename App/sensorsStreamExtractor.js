const { Observable,of,merge,empty } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap,distinct} = require('rxjs/operators');
var mqtt = require('./mqttCluster.js');
const VIDEOSEGMENTLENGTH=30*1000;
const WAITTIMEFORMOVEMENTAFTEROPENINGDOOR=15*1000;
const WAITTIMEFOROPENINGDOOR = 30*1000
const sensorsReadingStream = new Observable(async subscriber => {  
    console.log('subscribing sensorsReadingStream')
    var mqttCluster=await mqtt.getClusterAsync()   
    mqttCluster.subscribeData('Eurodomest', function(content){
        if (content.ID==='206aae' || content.ID==='006aae'){
            subscriber.next({data:'16340250'})
        }
    });
    mqttCluster.subscribeData('EV1527', function(content){
        if (content.ID==='04f0f4'){
            subscriber.next({data:'233945'})
        }
    });
});


const throttledReadingsStreams = sensorsReadingStream.pipe(
    map(r => ({
        sensorId: parseInt(r.data),
        timestamp: (new Date).getTime(),                
    })),
    groupBy(r => r.sensorId, r => r),    
    mergeMap(s => s.pipe(throttleTime(3000))),    
    tap(v => console.log(v)),   
    share()     
)
const doorOpenSensor = throttledReadingsStreams.pipe(filter(r => r.sensorId===233945),share());
const outsideMovementSensor = throttledReadingsStreams.pipe(filter(r => r.sensorId===16340250),share());

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
