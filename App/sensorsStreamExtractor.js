const { Observable } = require('rxjs');
const { groupBy,mergeMap,throttleTime} = require('rxjs/operators');
var mqtt = require('./mqttCluster.js');
const sensorsReadingStream = new Observable(async subscriber => {  
    var mqttCluster=await mqtt.getClusterAsync()   
    mqttCluster.subscribeData(global.sensorReadingTopic, function(content){
        subscriber.next(content)
    });
});


const throttledReadingsStreams = sensorsReadingStream.pipe(
    groupBy(r => r.data, r => r),    
    mergeMap(s => s.pipe(throttleTime(4000))),        
)

exports.sensorsReadingStream = throttledReadingsStreams
