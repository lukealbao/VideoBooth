/*
 * This thing doesn't actually work, but it has good things in it.
*/
navigator.getUserMedia  =  navigator.getUserMedia    || navigator.webkitGetUserMedia ||
                          navigator.mozGetUserMedia || navigator.msGetUserMedia;

function VideoBooth(options) {
  this.state = 'idle';
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

  options.alertText = document.createElement('div');
  this.alertText = options.alertText;
  this.alertText.className = `video-alert`;
  this.alertEl.appendChild(this.alertText);
}

// VideoBooth.prototype.alert = function(type, content) {
//   $(this.alertEl).append('<div class="alert alert-'+ type +'" role="alert">'+ content +'</div>');
// };

VideoBooth.prototype.alert = function(type, content) {
  var element = this.alertText;
  element.setAttribute('style', 'opacity: 0;');
  element.textContent = content;

  element.setAttribute('style', 'opacity: 1;');
  setTimeout(function () {
    element.setAttribute('style', 'opacity: 0;');
  }, 5e3);
  setTimeout(function () {
    element.textContent = '';
  }, 6001);
};

VideoBooth.prototype.errCallback = function(e) {
  console.error(e);
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
    console.log(`[${new Date().toJSON()}] Loaded video`);
  };
};

VideoBooth.prototype.start = function(seconds, cb) {
  if (!this.stream) { throw new Error('No stream available to record'); }
  if (!window.MediaRecorder) { alert("This browser doesn't support MediaRecorder. :( Firefox only for now!"); }

  this.recorder = new MediaRecorder(this.stream);
  this.recorder.start();
  cb();
};

VideoBooth.prototype.stop = function(cb) {
  this.recorder.stop();
  this.recorder.ondataavailable = this.finished.bind(this);
  $(this.videoEl).removeClass('recording');
  cb();
};

VideoBooth.prototype.finished = function(e) {
  var blob = new Blob([e.data], { type: e.data.type });
  this.recording = blob;
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
    }).fail(function(err) {
      cb(err);
    });
  };
  reader.readAsDataURL(recording);  
};
var booth;
$(function() {
  booth = new VideoBooth({
    videoEl: 'user-media',
    recordedEl: 'recorded-media',
    countdownEl: 'countdown',
    uploadProgressEl: 'upload-progress',
    alertEl: 'alerts'
  });

  window.onload = function(e) {
    e.preventDefault();

    booth.requestMedia();
  };
  
  $('#record').click(function (e) {
    if (booth.state === 'idle') {
      booth.start(5, function() {
        booth.state = 'recording';
        
        $('#record')
          .removeClass('btn-success')
          .addClass('btn btn-danger')
          .html('▣ Stop Recording');
        
        $(this.videoEl).addClass('recording');
        $('#recording-overlay').removeClass('hidden');
      });
    } else if (booth.state === 'recording') {
      booth.stop(function() {
        booth.state = 'idle';

        $('#recorded-media, #upload').removeClass('hidden');
        $('#download').removeClass('hidden');
        $('#process').removeClass('hidden');
        $('#recording-overlay').addClass('hidden');
        $('#record')
          .removeClass('btn-danger')
          .addClass('btn btn-success')
          .html('<span style="color: red;">◉</span> Start Recording');      
      });
    }
  });
  
  $('#process').click(function(e) {
    e.preventDefault();

    booth.send(booth.recording, function(err, job) {
      if (err) { return booth.alert('danger', 'Job creation failed :('); }
    });
  });
});
