const { Observable,of,merge,empty } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,reduce, share,shareReplay, filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap,distinct} = require('rxjs/operators');
var mqtt = require('./mqttCluster.js');
const VIDEOSEGMENTLENGTH=30*1000;
const WAITTIMEFORMOVEMENTAFTEROPENINGDOOR=15*1000;
const WAITTIMEFOROPENINGDOOR = 30*1000

global.mtqqLocalPath = 'mqtt://piscos.tk'

const sensorsReadingStream = new Observable(async subscriber => {  
    console.log('subscribing sensorsReadingStream')
    var mqttCluster=await mqtt.getClusterAsync()   
    mqttCluster.subscribeData('test', function(content){
        if (content.ID==='door'){
            subscriber.next(content)
        }
    });
    mqttCluster.subscribeData('test', function(content){
        if (content.ID==='move'){
            subscriber.next(content)
        }
    });
});

const sharedStream = sensorsReadingStream.pipe(share())


const doorOpenSensor = sharedStream.pipe(filter(r => r.ID==='door'),share());
const outsideMovementSensor = sharedStream.pipe(filter(r => r.ID==='move'),share());
const lastEmitions = outsideMovementSensor.pipe(shareReplay(undefined,10000,undefined))
lastEmitions.subscribe()


const bef = doorOpenSensor.pipe(
    
    mergeMap(d => lastEmitions.pipe(        
        timeoutWith(0,empty()),        
        reduce((acc, _ ) => acc + 1, 0),
        map(n => Object.assign({count:n}, d))
        )
    )
)
bef.subscribe(c=> console.log(c))
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
