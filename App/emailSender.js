const { from,of,Observable,forkJoin } = require('rxjs');
const { groupBy,mergeMap,throttleTime,map,share,filter,first,mapTo,timeoutWith,toArray,takeWhile,delay,tap} = require('rxjs/operators');
const fs = require('fs');
const util = require('util');
const {google} = require('googleapis');
const { oauthStream } = require('./googleOauth');
const dateFormat = require('dateformat');

const sendEmailStream =(auth,base64EncodedEmail) => from(google.gmail('v1').users.messages.send({
    auth: auth,
    userId: 'me',
    resource: {
      raw: base64EncodedEmail
    }
  }));






function getEmailParameters(eventInfo) {
    const body = JSON.stringify(eventInfo) + '\n' + eventInfo.youtubeURL;
    const htmlBody = body.split('\n').join('\n<br>\n');
    const emailParams = {
      fromName: 'HOME',
      fromAddress: 'entrancecamera123@gmail.com',
      //to: 'mig.ruiz@gmail.com',
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
            return `=?utf-8?Q?DOOR_OPEN_=E2=9D=8C_NO_MOVEMENT_at_${dateFormat(date, "h:MM:ss TT")}?=`;         
        case 'MOVEMENT_BEFORE_AND_AFTER':
            return `=?utf-8?Q?DOOR_OPEN_=E2=AD=95_MOVEMENT_BEFORE_=26_AFTER_at_${dateFormat(date, "h:MM:ss TT")}?=`;         
        case 'EXITING':        
            return `=?utf-8?Q?=3C--=F0=9F=9A=AA_EXITING_at_${dateFormat(date, "h:MM:ss TT")}?=`;         
        case 'ENTERING':
            return  `=?utf-8?Q?--=3E=F0=9F=8F=A1_ENTERING_at_${dateFormat(date, "h:MM:ss TT")}?=`;         
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