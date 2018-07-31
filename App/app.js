'use strict';
var spawn = require('child_process').spawn;
var Inotify = require('inotify').Inotify;
var inotify = new Inotify();

var videosFolder = process.env.VIDEOSPATH;
var ffmpegFolder = process.env.FFMPEGPATH;
function ExtractedVideosMonitor(onVideoBadFormat) {
    this.start = function () {
        inotify.addWatch({
            path: videosFolder,
            watch_for: Inotify.IN_ALL_EVENTS,
            callback: onNewFileGenerated
        });
    }

    function onNewFileGenerated(event) {
        var mask = event.mask;
        if (mask & Inotify.IN_CLOSE_WRITE) {
            extractVideoDetails(videosFolder + event.name, function (videoInfo) {
                if (!isVideoOK(videoInfo)) {
                    onVideoBadFormat();
                }
            });
        }
    }
    function isVideoOK(videoInfo) {
        var videoOK = false;
        videoInfo.streams.forEach(stream => {
            if (stream.codec_type === 'video' && stream.duration_ts > 10) {
                videoOK = true;
            }
        });
        return videoOK;
    }
    function extractVideoDetails(videoPath, onResult) {
        const ffprobe = spawn(ffmpegFolder+'ffprobe'
            , [
                '-v'
                , 'quiet'
                , '-print_format'
                , 'json'
                , '-show_format'
                , '-show_streams'
                , videoPath
            ]);

        var result = '';
        ffprobe.stdout.on('data', (data) => {
            result += data.toString();
        });
        ffprobe.stderr.on('data', (data) => {
            console.error(`child stderr:\n${data}`);
        });
        ffprobe.on('exit', function (code, signal) {
            var info = JSON.parse(result);
            onResult(info);
        });
    }
}



function FFmpegExtractor() {
    var ffmpegChild = null;
    var startNewProcess = function () {
        ffmpegChild = spawn(ffmpegFolder+'ffmpeg'
            , [
                '-loglevel'
                , 'panic'
                , '-i'
                , process.env.ENTRANCECAMRTSP
                , '-pix_fmt'
                , '+'
                , '-c:v'
                , 'copy'
                , '-c:a'
                , 'aac'
                , '-strict'
                , 'experimental'
                , '-f'
                , 'segment'
                , '-strftime'
                , '1'
                , '-segment_time'
                , '30'
                , '-segment_format'
                , 'mp4'
                , videosFolder + '%Y-%m-%d_%H-%M-%S.mp4'
            ]);
        ffmpegChild.stdout.on('data', (data) => {
            console.log(data);
        });
        ffmpegChild.stderr.on('data', (data) => {
            console.error(`child stderr:\n${data}`);
        });
        ffmpegChild.on('exit', function (code, signal) {
            console.log('child process exited with ' + `code ${code} and signal ${signal}`);
            setTimeout(function () {
                startNewProcess();
            }, 4000);
        });
    }
    this.start = startNewProcess;
    this.killffmpeg = function () {
        console.log('restarting ffmpeg');
        if (ffmpegChild != null)
            ffmpegChild.kill();
    }
}

var videoExtractor = new FFmpegExtractor();
var extractedVideosMonitor = new ExtractedVideosMonitor(function () {
    videoExtractor.killffmpeg();
});
extractedVideosMonitor.start();
videoExtractor.start();
