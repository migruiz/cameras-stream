'use strict';
const { Observable,of,merge,empty,interval,from } = require('rxjs');
const { groupBy,mergeMap,throttle,map,share,filter,first,mapTo,timeoutWith,timeout,shareReplay,ignoreElements,debounceTime, toArray,takeWhile,endWith,delay,tap,distinct,bufferWhen,switchMapTo} = require('rxjs/operators');
var mqtt = require('../mqttCluster.js');

const movementSensorsReadingStream = new Observable(async subscriber => {  
    var mqttCluster=await mqtt.getClusterAsync()   
    mqttCluster.subscribeData('zigbee2mqtt/0x00158d000595b372', function(content){        
        if (content.occupancy){      
            subscriber.next((new Date).getTime())
        }
    });
    mqttCluster.subscribeData('zigbee2mqtt/0xa4c1383eda8e611e', function(content){        
        if (content.occupancy){      
            subscriber.next((new Date).getTime())
        }
    });
    mqttCluster.subscribeData('zigbee2mqtt/0x00158d0007c3846b', function(content){     
        if (!content.contact)   {
            subscriber.next((new Date).getTime())
        }
    });
});

const sharedSensorStream = movementSensorsReadingStream.pipe(share())

const turnOffStream = sharedSensorStream.pipe(
    debounceTime(7*1000),
    mapTo({eventType:"off"}),    
    share()
    )

turnOffStream.subscribe()

const turnOnStream = sharedSensorStream.pipe(
    throttle(_ => turnOffStream),
    map(timestamp => ({timestamp, eventType:"on"}))
)

const combinedStream = turnOnStream.pipe(
    mergeMap(on => turnOffStream.pipe(
        first(),
        mapTo(on)
        )
    ),
    map(on => ({start:on.timestamp, end:(new Date).getTime()})),
    map(event => ({start:event.start - 7 * 1000, end:event.end}))
   )



const { probeVideoInfo} = require('../ffprobeVideoDetailsExtractor');
const path = require('path');
var Inotify = require('inotify').Inotify;
var inotify = new Inotify();


var spawn = require('child_process').spawn;
const fs = require('fs-extra')
const util = require('util');
const videosFolder = '/videos/'
const targetFolder = '/movementVideos/videos/'
const movementTempFolder = `${videosFolder}movements/`
const ffmpegFolder = '/ffmpeg/';

const videoFilesStream = new Observable(subscriber => {  
    inotify.addWatch({
        path: videosFolder,
        watch_for: Inotify.IN_ALL_EVENTS,
        callback: event => subscriber.next(event)
    });
})
const segmentStream = videoFilesStream.pipe(
    filter(e => e.mask & Inotify.IN_CLOSE_WRITE),
    timeout(1 * 60 * 1000),
    map(e => e.name),
    mergeMap(fileName => probeVideoInfo(videosFolder + fileName)),
    mergeMap(videoInfo => videoInfo.format.duration < 20 ? throwError('Error length video '+ JSON.stringify(videoInfo)) : of(videoInfo)),
    map(videoInfo => (
        {
            fileName:videoInfo.format.filename,
            startTime:1000 * parseInt(path.basename(videoInfo.format.filename,'.mp4')),            
            length:1000 * Math.round(parseFloat(videoInfo.format.duration))
        }
    )),
    map(videoInfo => Object.assign({endTime:videoInfo.startTime+videoInfo.length}, videoInfo)),
    shareReplay(10)
)
segmentStream.subscribe()


 var streamToListen =   combinedStream.pipe(   
    mergeMap( ev =>         
        segmentStream.pipe(      
            filter(s=>s.endTime > ev.start)
            ,takeWhile(s=> s.startTime < ev.end)
            ,toArray()
            ,map(a => Object.assign({videos:a, videosStartTime:a[0].startTime, videosEndTime:a[a.length-1].endTime},ev))
            ,map(event => Object.assign({videosStartTimeSecs:Math.round(parseFloat(event.videosStartTime/1000)),videosEndTimeSecs:Math.round(parseFloat(event.videosEndTime/1000))},event))
            ,map(event => Object.assign({startSecs:Math.round(parseFloat(event.start/1000)),endSecs:Math.round(parseFloat(event.end/1000))},event))
        )
    )
)


const extractVideoStream = streamToListen.pipe(
    map(event => Object.assign({eventSubFolderPath:`${movementTempFolder}${event.start}/`}, event)),
    map(event => Object.assign({eventTargetFolderPath:`${targetFolder}${event.start}/`}, event)),
    map(event => Object.assign({filesToJoinPath:`${event.eventSubFolderPath}${event.start}.txt`}, event)),
    map(event => Object.assign({eventInfoJsonFilePath:`${event.eventSubFolderPath}info.json`}, event)),
    map(event => Object.assign({joinedVideoPath:`${event.eventSubFolderPath}${event.start}_joined.mp4`}, event)),
    map(event => Object.assign({targetVideoPath:`${event.eventSubFolderPath}${event.start}.mp4`}, event)),
    map(event => Object.assign({filesToJoinContent:event.videos.map(v => `file ${v.fileName}`).join('\r\n')}, event)),
    mergeMap(v => createSubFolder(v.eventSubFolderPath).pipe(endWith(v))),    
    mergeMap(v => writeFileStream(v.filesToJoinPath,v.filesToJoinContent).pipe(endWith(v))),    
    mergeMap(v => joinFilesStream(v.filesToJoinPath,v.joinedVideoPath).pipe(endWith(v))),
    mergeMap(v => ffmpegextractVideoStream(v.startSecs - v.videosStartTimeSecs, v.endSecs - v.startSecs, v.joinedVideoPath,v.targetVideoPath).pipe(endWith(v))),
    mergeMap(v => removeFile(v.filesToJoinPath).pipe(endWith(v))),
    mergeMap(v => removeFile(v.joinedVideoPath).pipe(endWith(v))),
    mergeMap(v => writeFileStream(v.eventInfoJsonFilePath,JSON.stringify(v)).pipe(endWith(v))),   
    mergeMap(v => moveDirectory(v.eventSubFolderPath,v.eventTargetFolderPath).pipe(endWith(v))),   
);


const removeFile = path =>  from(util.promisify(fs.unlink)(path)).pipe(switchMapTo(empty()));
const createSubFolder = path =>  from(util.promisify(fs.mkdir)(path)).pipe(switchMapTo(empty()));
const writeFileStream = (path,content) =>  Observable.create(subscriber => {  
    fs.writeFile(path, content, function (err) {
        if (err) {
            subscriber.error(err)
        }
        subscriber.complete();
    });
});

const moveDirectory = (src,dest) =>  Observable.create(subscriber => {  
    fs.move(src, dest, function (err) {
        if (err) {
            subscriber.error(err)
        }
        subscriber.complete();
    });
});




const joinFilesStream = (filesToJoinPath,targetFile) => Observable.create(subscriber => {   
    const params=  [
        '-y'
        , '-f'
        , 'concat'
        , '-safe'
        , '0'
        , '-i'
        , filesToJoinPath
        , '-c'
        , 'copy'
        , targetFile
    ]
    const ffmpegChild = spawn(ffmpegFolder+'ffmpeg',params);
    var result = '';
    ffmpegChild.stdout.on('data', (data) => {
        result += data.toString();
    });
    var errorResult = '';
    ffmpegChild.stderr.on('data', (data) => {
      errorResult += data.toString();
    });
    ffmpegChild.on('exit', function (code, signal) {
      if (code) {
        console.log(JSON.stringify({filesToJoinPath,targetFile,code,signal,result,errorResult}))
        subscriber.error('joinFilesStream error');
      } else if (signal) {
        console.log(JSON.stringify({filesToJoinPath,targetFile,code,signal,result,errorResult}))
        subscriber.error('joinFilesStream error');
      } else {
        subscriber.complete();
      }     
    }); 
});



function toHHMMSS(sec_num) {
  var hours   = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
  var seconds = sec_num - (hours * 3600) - (minutes * 60);

  if (hours   < 10) {hours   = "0"+hours;}
  if (minutes < 10) {minutes = "0"+minutes;}
  if (seconds < 10) {seconds = "0"+seconds;}
  return hours+':'+minutes+':'+seconds;
}

const ffmpegextractVideoStream = (startPosition,lengthSecs,joinedVideoPath,targetVideoPath) => Observable.create(subscriber => {   
    const params = [
        '-y'
        , '-ss'
        , toHHMMSS(startPosition)
        , '-i'
        , joinedVideoPath
        , '-t'
        , toHHMMSS(lengthSecs)
        , '-vcodec'
        , 'copy'
        , '-acodec'
        , 'copy'
        , targetVideoPath
    ];
    const ffmpegChild = spawn(ffmpegFolder+'ffmpeg',params);
    var result = '';
    ffmpegChild.stdout.on('data', (data) => {
        result += data.toString();
    });
    var errorResult = '';
    ffmpegChild.stderr.on('data', (data) => {
      errorResult += data.toString();
    });
    ffmpegChild.on('exit', function (code, signal) {
      if (code) {
        console.log(JSON.stringify({startPosition,joinedVideoPath,targetVideoPath,code,signal,result,errorResult}))
        subscriber.error('ffmpegextractVideoStream error');
      } else if (signal) {
        console.log(JSON.stringify({startPosition,joinedVideoPath,targetVideoPath,code,signal,result,errorResult}))
        subscriber.error('ffmpegextractVideoStream error');
      } else {
        subscriber.complete();
      }     
    }); 
});




exports.movementStream = extractVideoStream



