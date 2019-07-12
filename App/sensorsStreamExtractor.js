const { Observable } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map} = require('rxjs/operators');
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
        timestamp: parseInt(path.basename(r.fileName,'.csv'))
    })),
    groupBy(r => r.sensorId, r => r),    
    mergeMap(s => s.pipe(throttleTime(4000))),        
)

exports.sensorsReadingStream = throttledReadingsStreams
