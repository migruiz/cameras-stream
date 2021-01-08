const { Observable,of,merge,empty,interval } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,timeout,shareReplay,ignoreElements,debounceTime, toArray,takeWhile,delay,tap,distinct,bufferWhen} = require('rxjs/operators');
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

exports.movementStream = combinedStream



