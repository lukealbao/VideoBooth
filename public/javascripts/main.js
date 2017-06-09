// Do the vendor prefix dance
navigator.getUserMedia  =  navigator.getUserMedia    || navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia || navigator.msGetUserMedia;

function VideoBooth(options) {
  options.videoEl = document.getElementById(options.videoEl);
  this.videoEl = options.videoEl;

  options.recordedEl = document.getElementById(options.recordedEl);
  this.recordedEl = options.recordedEl;

  options.countdownEl = document.getElementById(options.countdownEl);
  this.countdownEl = options.countdownEl;

  options.uploadProgressEl = document.getElementById(options.uploadProgressEl);
  this.uploadEl = options.uploadProgressEl;

  options.alertEl = document.getElementById(options.alertEl);
  this.alertEl = options.alertEl;
}

VideoBooth.prototype.alert = function(type, content) {
  $(this.alertEl).append('<div class="alert alert-'+ type +'" role="alert">'+ content +'</div>');
};

VideoBooth.prototype.errCallback = function(e) {
  console.log('Did you just reject me?!', e);
};

VideoBooth.prototype.requestMedia = function() {
  // Use the vendor prefixed getUserMedia we set up above and request just video
  navigator.getUserMedia({
    video: {
      mandatory: {
        minWidth: 1280,
        minHeight: 720
      }
    },
    audio: true
  }, this.showMedia.bind(this), this.errCallback.bind(this));
};

VideoBooth.prototype.showMedia = function(stream) {
  this.stream = stream;

  var video = this.videoEl;
  video.src = window.URL.createObjectURL(stream);

  video.onloadedmetadata = function(e) {
    console.log('Locked and loaded.');
  };
};

VideoBooth.prototype.start = function(seconds, cb) {
  if (!this.stream) { throw new Error('No stream available to record'); }
  if (!window.MediaRecorder) { alert("This browser doesn't support MediaRecorder. :( Firefox only for now!"); }

  this.recorder = new MediaRecorder(this.stream);
  this.recorder.start();

  $(this.videoEl).addClass('recording');

  //setTimeout(this.stop.bind(this, cb), seconds * 1000);
  this.countdown(seconds);
};

VideoBooth.prototype.stop = function(cb) {
  this.recorder.stop();
  this.recorder.ondataavailable = this.finished.bind(this);
  $(this.videoEl).removeClass('recording');
  cb();
};

VideoBooth.prototype.countdown = function(seconds) {
  if (seconds === 0) { return $(this.countdownEl).text(''); }
  $(this.countdownEl).text(seconds);

  setTimeout(this.countdown.bind(this, seconds - 1), 1000);
};

VideoBooth.prototype.finished = function(e) {
  var blob = new Blob([e.data], { type: e.data.type });
  this.playBackRecorded(blob);
  this.recording = blob;
};

VideoBooth.prototype.playBackRecorded = function(blob) {
  var blobUrl = URL.createObjectURL(blob);
  var video = this.recordedEl;
  video.src = blobUrl;

  video.onended = function() {
    // There seems to be a bug in FF around trying to loop or set current time on
    // these blobs after they're done. This is a gross hack to fix that.
    video.pause();
    video.src = blobUrl;
  };
};

VideoBooth.prototype.upload = function(cb) {
  console.log('deprecating #upload');
  return;
  var recording = this.recording;
  if (!recording) { throw new Error('No recording to upload.'); }

  var filename = this.filename = Date.now() + '.webm';
  var $uploadProgress = $(this.uploadEl);

  $uploadProgress.text('0%');

  // Grab a signed URL from the backend
  // $.post('/upload', { key: filename }).done(function(data) {
  //   formUpload(data.url, data.cors.key, data.cors.policy, data.cors.signature, filename, recording);
  // });

  formUpload('/process', 'key', 'policy', 'signature', filename, recording);
  function formUpload(url, accessKey, policy, signature, filename, data) {
    var fd = new FormData();

    fd.append('key', filename);
    fd.append('AWSAccessKeyId', accessKey);
    fd.append('acl', 'private');
    fd.append('policy', policy);
    fd.append('signature', signature);
    fd.append('Content-Type', "video/webm");
    fd.append("file",  data);

    $.ajax({
      xhr: function() {
        var xhr = new window.XMLHttpRequest();
        xhr.upload.addEventListener("progress", function(e) {
          if (e.lengthComputable) {
            var progress = e.loaded / e.total;
            //Do something with upload progress here
            progress = (progress * 100).toFixed(2);
            $uploadProgress.text(progress + '%');
          }
        }, false);

        return xhr;
      },
      type: 'POST',
      url: url,
      data: fd,
      processData: false,
      contentType: false
    }).done(function(data) {
      cb(null);
    }).fail(function(jqxhr, status, err) {
      cb(jqxhr);
    });

  }
};

VideoBooth.prototype.send = function(recording, cb) {
  var reader = new window.FileReader();
  reader.onloadend = function() {
    var dataString = reader.result;          
    $.post('/process', {
      filename: 'recording-' + (new Date()).getTime() + '.wm',
      recording: dataString
    }).done(function(data) {
      cb(null, data);
    }).fail(function(data) {
      cb(data);
    });
  };
  reader.readAsDataURL(recording);  
};

VideoBooth.prototype.process = function(email, cb) {
  recording = this.recording;
  $.post('/process', {
    filename: this.filename,
    email: email,
    recording: this.recording
  }).done(function(data) {
    cb(null, data);
  }).fail(function(data) {
    cb(data);
  });
};

$(function() {
  var booth = new VideoBooth({
    videoEl: 'user-media',
    recordedEl: 'recorded-media',
    countdownEl: 'countdown',
    uploadProgressEl: 'upload-progress',
    alertEl: 'alerts'
  });

  $('#get-user-media').click(function(e) {
    e.preventDefault();

    booth.requestMedia();

    $(this).addClass('hidden');
    $('#record').removeClass('hidden');
    $('#stop').removeClass('hidden');
  });

  $('#record').click(function(e) {
    e.preventDefault();

    // Kick off a 5 second recording!
    booth.start(5, function() {
      $('#recorded-media, #upload').removeClass('hidden');
    });
  });

  $('#stop').click(function(e) {
    e.preventDefault();

    // Kick off a 5 second recording!
    booth.stop(function() {
      $('#recorded-media, #upload').removeClass('hidden');
      $('#download').removeClass('hidden');
      $('#process').removeClass('hidden');

      // setTimeout(function () { // timeout, booth.recording was undefined
      //   booth.send(booth.recording, function(err, job) {
      //     if (err) { return booth.alert('danger', 'Job creation failed :('); }
      //     booth.alert('cool');
      //   });
      // }, 100);
    });
  });
  
  $('#process').click(function(e) {
    e.preventDefault();

    booth.send(booth.recording, function(err, job) {
      if (err) { return booth.alert('danger', 'Job creation failed :('); }
      booth.alert('cool');
    });
  });
});
