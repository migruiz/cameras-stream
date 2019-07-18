const { from,of,Observable,forkJoin } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap} = require('rxjs/operators');
const fs = require('fs');
const util = require('util');
const {google} = require('googleapis');
const { oauthStream } = require('./googleOauth');

const sendEmailStream =(auth,base64EncodedEmail) => from(google.gmail('v1').users.messages.send({
    auth: auth,
    userId: 'me',
    resource: {
      raw: base64EncodedEmail
    }
  }));






function getEmailParameters(eventInfo) {
    const body = eventInfo.youtubeURL;
    const htmlBody = body.split('\n').join('\n<br>\n');
    const emailParams = {
      fromName: 'home',
      fromAddress: 'migruizcameras@gmail.com,soniacarolina.blanco@gmail.com',
      to: 'mig.ruiz@gmail.com',
      subject:getSubject(eventInfo.sensor),
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
            return `<-- EXITING HOME at  ${date.getHours()}:${date.getMinutes()}`;
        case 'ENTERING':
            return `--> ENTERING HOME at  ${date.getHours()}:${date.getMinutes()}`;
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


  const resultStream =function(event){
    const base64Email = getBase64Email(getEmailParameters(event))
    return oauthStream(auth => sendEmailStream(auth,base64Email))
  }

exports.emailStream = resultStream;