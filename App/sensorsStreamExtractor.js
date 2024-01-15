const { Observable,of,merge,empty,timer } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,reduce,takeUntil, share,shareReplay, filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap,distinct} = require('rxjs/operators');
var mqtt = require('./mqttCluster.js');
const VIDEOSEGMENTLENGTH=30*1000;
const HALFWINDOW = 20000

const sensorsReadingStream = new Observable(async subscriber => {  
    console.log('subscribing sensorsReadingStream')
    const mqttCluster=await mqtt.getClusterAsync()   
    mqttCluster.subscribeData('zigbee2mqtt/0x00158d000595b372', function(content){        
        if (content.occupancy){      
            subscriber.next({data:'16340250'})
        }
    });
    mqttCluster.subscribeData('zigbee2mqtt/0xa4c1383eda8e611e', function(content){        
        if (content.occupancy){      
            subscriber.next({data:'16340250'})
        }
    });
    mqttCluster.subscribeData('zigbee2mqtt/0x00158d0007c3846b', function(content){     
        if (!content.contact)   {
            subscriber.next({data:'233945'})
        }
    });
});



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
    map(r=>({sensorId:r.sensorId, timestamp:r.timestamp})),
    share()
    );
const outsideMovementSensor = sharedStream.pipe(filter(r => r.sensorId===16340250),share());

const movementBeforeDoorEvent = outsideMovementSensor.pipe(shareReplay(undefined,HALFWINDOW,undefined))
const movementAfterDoorEvent = outsideMovementSensor
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
        takeUntil(timer(HALFWINDOW)),        
        reduce((acc, _ ) => acc + 1, 0),
        map(n => Object.assign({countAfter:n,finished:true}, d))
        )
    )
)

const doorOpenStream = merge(beforeDoorEventStream,afterDoorEventStream).pipe(
    groupBy(r => r.timestamp, r => r),
    mergeMap(stream => stream.pipe( takeWhile(e => !e.finished,true),toArray())),
    map(([befDoor,afterDoor]) =>  Object.assign(befDoor, afterDoor)),
    map( e => Object.assign({type:getEventType(e)}, e)),
    map( e => Object.assign({endVideoAt:getEndTime(e)}, e)),
    map( e => Object.assign({startVideoAt: e.endVideoAt - VIDEOSEGMENTLENGTH}, e)),
)



function getEventType(e){
    if (e.countBefore===0 && e.countAfter===0){
        return 'NO_MOVEMENT'
    }
    else if (e.countAfter === e.countBefore){
        return 'MOVEMENT_BEFORE_AND_AFTER'
    }
    else if (e.countBefore > e.countAfter){
        return 'ENTERING'
    }
    else if (e.countBefore < e.countAfter){
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
