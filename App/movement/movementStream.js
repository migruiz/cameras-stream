
const { Observable,of,interval,timer,from,empty} = require('rxjs');
const { map,buffer,withLatestFrom,tap,share,last,expand,catchError,mergeMap,delay,mapTo,concatMap,switchMapTo,endWith,repeat,shareReplay,timeout,first,filter,merge,timeoutWith,take,toArray,zip} = require('rxjs/operators');

const { movementStream } = require('./movementStreamExtractor');
const { uploadVideoStream } =require('./uploadYoutube')
const { extractMovementVideoStream } = require('./sensorVideoExtractor')
const { emailStream } = require('./emailSender')

const resultStream  = movementStream.pipe(
    concatMap(v=> extractMovementVideoStream(v).pipe(map(extractedVideoPath => Object.assign({extractedVideoPath},v)))), 
    concatMap(v=> uploadVideoStream(v).pipe(map(youtubeURL => Object.assign({youtubeURL},v)))),
    concatMap(v=> emailStream(v).pipe(map(gmailData => Object.assign({gmailData},v))))    
    )

exports.movementStream = resultStream