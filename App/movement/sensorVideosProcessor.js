'use strict';
const { probeVideoInfo} = require('../ffprobeVideoDetailsExtractor');
const { oauthStream } = require('../googleOauth');
const { emailStream } = require('./emailSender');
const {google} = require('googleapis');
const dateFormat = require('dateformat');
const rimraf = require("rimraf");
const CronJob = require('cron').CronJob;

/**
 * Usage: node upload.js PATH_TO_VIDEO_FILE
 */
const spawn = require('child_process').spawn;
const fs = require('fs-extra');
const util = require('util');
const path = require('path');
const { from,of, Observable,forkJoin,iif,throwError,defer,interval,empty } = require('rxjs');
const { groupBy,take, endWith,reduce,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap,catchError,concatMap,switchMapTo} = require('rxjs/operators');


const readDirStream = path =>  from(util.promisify(fs.readdir)(path));
const videosFolder = '/movementVideos/videos/'
const videosFolderProcessed = '/movementVideos/processed/'
const videosFolderProcessing = '/movementVideos/processing/'
const ffmpegFolder = '/ffmpeg/';

const resultStream = videoPath =>   readDirStream(videoPath).pipe(
    concatMap(arr => from(arr)),
    map(dir =>({dir:dir,createdAt: parseInt(path.basename(dir,'.mp4'))})),    
    map(fi => Object.assign({videoDirectory:`${videosFolder}${fi.dir}/`}, fi)),    
    map(fi => Object.assign({videoFile:`${fi.videoDirectory}${fi.dir}.mp4`}, fi)),    
    concatMap(fi => probeVideoInfo(fi.videoFile).pipe(map(kt => Object.assign({duration:parseFloat(kt.format.duration)}, fi)))),
    map(fi => Object.assign({videoFile:`${fi.videoFile}`}, fi)),
    map(fi => Object.assign({createdDate:new Date(fi.createdAt)}, fi)),
    map(fi => Object.assign({referenceCreatedDate:new Date(fi.createdAt - 9 * 60 * 60 * 1000)}, fi)),
    map(fi => Object.assign({referenceDateDay:fi.referenceCreatedDate.getDate()}, fi)),
    groupBy(fi => fi.referenceDateDay, r=>r),
    mergeMap(group$ =>
        group$.pipe(reduce((acc, cur) => [...acc, cur], [`${group$.key}`]))
      ),
      
    map(arr => ({ referenceDateDay: parseInt(arr[0], 10), values: arr.slice(1) })),
    map(v => ({ referenceDateDay: v.referenceDateDay, values: v.values.reduce((acc,cur) => [...acc,Object.assign({relativeStartTimeSecs:acc.reduce((a,{duration}) => a+ duration,0)},cur)],[]) })),
    map(v => ({ referenceDateDay: v.referenceDateDay, values: v.values.map(inf => Object.assign({youtubeTime:getYoutubeTime(inf.relativeStartTimeSecs)},inf))})),
    map(event => Object.assign({youtubeDescription:event.values.map(v => `${v.youtubeTime} ${dateFormat(v.createdDate, "h;MM TT, dddd mmmm dS")}`).join('\r\n')}, event)),
    map(event => Object.assign({youtubeTitle: `${dateFormat(event.values[0].createdDate, "h:MM TT, dddd mmmm dS")} to ${dateFormat(event.values[event.values.length-1].createdDate, "h:MM TT, dddd mmmm dS")}`},event)),
    
    map(event => Object.assign({startTimeStamp:event.values[0].createdAt}, event)),
    map(event => Object.assign({processingSubFolder:`${videosFolderProcessing}${event.referenceDateDay}_${Math.random().toString(36).substring(7)}/`}, event)),
    map(event => Object.assign({processedSubFolder:`${videosFolderProcessed}${event.referenceDateDay}_${Math.random().toString(36).substring(7)}/`}, event)),
    map(event => Object.assign({filesToJoinPath:`${event.processingSubFolder}filesToJoin.txt`}, event)),
    map(event => Object.assign({joinedVideoPath:`${event.processingSubFolder}joined.mp4`}, event)),
    map(event => Object.assign({dayInfoPath:`${event.processingSubFolder}dayInfo.json`}, event)),
    map(event => Object.assign({filesToJoinContent:event.values.map(v => `file ${v.videoFile}`).join('\r\n')}, event)),
    concatMap(v => createSubFolder(v.processingSubFolder).pipe(endWith(v))),  
    concatMap(v => writeFileStream(v.filesToJoinPath,v.filesToJoinContent).pipe(endWith(v))),    
    concatMap(v => writeFileStream(v.dayInfoPath,JSON.stringify(v)).pipe(endWith(v))),    
    concatMap(v => joinFilesStream(v.filesToJoinPath,v.joinedVideoPath).pipe(endWith(v))),
    concatMap(v => deleteVideosObservable(v.values).pipe(endWith(v))),
    concatMap(v => moveDirectory(v.processingSubFolder,v.processedSubFolder).pipe(endWith(v))),
    
)

const moveDirectory = (src,dest) =>  Observable.create(subscriber => {  
    fs.move(src, dest, function (err) {
        if (err) {
            subscriber.error(err)
        }
        subscriber.complete();
    });
});
const deleteVideosObservable = videos => {
    const listOfObservables = videos.map(v=> removeDirectoryStream(v.videoDirectory))
    return forkJoin(listOfObservables)
}

const getYoutubeTime = deltaMiliSecs =>{
    const sec_num = Math.floor(deltaMiliSecs)
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);
  
    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+':'+minutes+':'+seconds;
}

const createSubFolder = path =>  from(util.promisify(fs.mkdir)(path)).pipe(switchMapTo(empty()));
const readfileStream = path =>  from(util.promisify(fs.readFile)(path));
const writeFileStream = (path,content) =>  Observable.create(subscriber => {  
    fs.writeFile(path, content, function (err) {
        if (err) {
            subscriber.error(err)
        }
        subscriber.complete();
    });
});
const removeDirectoryStream = path =>  Observable.create(subscriber => { 
    rimraf(path,  function (err) {
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




const cronJobStream = (cronExpr) =>  Observable.create(subscriber => {  
    
     new CronJob(
        cronExpr,
        function() {
            subscriber.next();
        },
        null,
        true,
        'Europe/London'
    );
});


const resultStream2 = videoPath =>   readDirStream(videoPath).pipe(
    concatMap(arr => from(arr)),

    map(dir =>({directory:`${videoPath}${dir}/`})),  
    map(fi =>Object.assign({videoInfoFile:`${fi.directory}dayInfo.json`},fi)),    
    map(fi => Object.assign({videoFile:`${fi.directory}joined.mp4`}, fi)),   
    concatMap(fi=> readfileStream(fi.videoInfoFile)
        .pipe(
            map(it=>it.toString()),
            map(it=>JSON.parse(it)),
            map(it => ({youtubeTitle:it.youtubeTitle, youtubeDescription:it.youtubeDescription.substring(0, 4999),extractedVideoPath:fi.videoFile })),
            map(info => Object.assign(info, fi)),    
        )
    ),  
    concatMap(fi=> youtubeStream(fi)
            .pipe(
                map(it => Object.assign({youtubeURL :it}, fi)),
            )    
    ),
    concatMap(fi=> emailStream(fi).pipe(take(1),mapTo(fi))),
    concatMap(fi => removeDirectoryStream(fi.directory).pipe(endWith(fi)))
)




const uploadVideoStream =(auth,info) => from(

    google.youtube({
        version: 'v3',
        auth: auth,
      }).videos.insert(
        {
          part: 'id,snippet,status',
          notifySubscribers: false,
          requestBody: {
            snippet: {
              title: info.youtubeTitle,
              description: info.youtubeDescription,
            },
            status: {
              privacyStatus: 'unlisted',
            },
          },
          media: {
            body: fs.createReadStream(info.extractedVideoPath),
          },
        }
      )

);




const youtubeStream =function(info){
  return oauthStream(auth => uploadVideoStream(auth,info))
    .pipe(
      //mergeMap(v => removeFile(path).pipe(endWith(v))),
      map(v => `https://youtu.be/${v.data.id}`)
      );
}






const cronStream = cronJobStream('0 9 * * *').pipe(
        concatMap(_ => resultStream(videosFolder)),
        concatMap(_ => resultStream2(videosFolderProcessed))
    )
//const cronStream = of(1).pipe(concatMap(_ => resultStream(videosFolder) ))
//const cronStream2 = of(1).pipe(concatMap(_ => resultStream2(videosFolderProcessed) ))


exports.videoProcessorStream = cronStream