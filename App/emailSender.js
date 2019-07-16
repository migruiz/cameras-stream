const { from,of,Observable,forkJoin } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap} = require('rxjs/operators');
const fs = require('fs');
const util = require('util');
const {google} = require('googleapis');



const fileStream = path =>  from(util.promisify(fs.readFile)(path));
const sendEmailStream =(auth,base64EncodedEmail) => from(google.gmail('v1').users.messages.send({
    auth: auth,
    userId: 'me',
    resource: {
      raw: base64EncodedEmail
    }
  }));

const oAuthGoogle = fileStream('c:\\secrets\\credentialsCam.json').pipe
(
    map(cr => JSON.parse(cr)),
    map(cr => new google.auth.OAuth2(cr.installed.client_id, cr.installed.client_secret, cr.installed.redirect_uris[0])),
)
const oUathToken = fileStream('c:\\secrets\\tokenCam.json').pipe
(
    map(cr => JSON.parse(cr))
)



const sendNotificationEmailStream = eventInfoStream => eventInfoStream.pipe(
    map(event => ({event})),
    map(v => Object.assign({emailParams:getEmailParameters(v.event)}, v)),
    map(v => Object.assign({base64Email:getBase64Email(v.emailParams)}, v)),
    mergeMap(v => oAuthGoogle.pipe(map(oUth => Object.assign({oUth}, v)))),
    mergeMap(v => oUathToken.pipe(map(token => Object.assign({token}, v)))),
    tap(v => v.oUth.setCredentials(v.token)),
    mergeMap(v => sendEmailStream(v.oUth,v.base64Email)),
)


function getEmailParameters(eventInfo) {
    const body = 'youtube URL HERE'
    const htmlBody = body.split('\n').join('\n<br>\n');
    const emailParams = {
      fromName: 'home entrance',
      fromAddress: 'entrance@gmail.com',
      to: 'mig.ruiz@gmail.com',
      subject:getSubject(eventInfo),
      body: htmlBody
    };
    return emailParams;
  }

  function getSubject(eventInfo){
    const date = new Date(eventInfo.timestamp);
    switch(eventInfo.type) {
        case 'NO_MOVEMENT':
            return `DOOR OPEN: NO_MOVEMENT at  ${date.getHours()}:${date.getMinutes()}`;         
        case 'MOVEMENT_BEFORE_AND_AFTER':
            return `DOOR OPEN: MOVEMENT BEFORE & AFTER at  ${date.getHours()}:${date.getMinutes()}`;
        case 'EXITING':        
            return `EXITING HOME -> at  ${date.getHours()}:${date.getMinutes()}`;
        case 'ENTERING':
            return `-> ENTERING HOME at  ${date.getHours()}:${date.getMinutes()}`;
        default:
      }
  }

  function getBase64Email(emailParams){

    var email_lines = [];

    email_lines.push('From: "'+ emailParams.fromName + '" <' + emailParams.fromAddress + '>');
    email_lines.push('To: '+ emailParams.to);
    email_lines.push('Content-type: text/html;charset=iso-8859-1');
    email_lines.push('MIME-Version: 1.0');
    email_lines.push('Subject: ' + emailParams.subject);
    email_lines.push('');
    email_lines.push(emailParams.body);

    var email = email_lines.join('\r\n').trim();

    var base64EncodedEmail = new Buffer(email).toString('base64');
    base64EncodedEmail = base64EncodedEmail.replace(/\+/g, '-').replace(/\//g, '_');
    return base64EncodedEmail;
  }


exports.emailStream = sendNotificationEmailStream;