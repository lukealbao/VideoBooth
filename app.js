var express    = require('express');
var path       = require('path');
var logger     = require('morgan');
var bodyParser = require('body-parser');
var fs = require('fs');

var app = express();

app.set('port', process.env.PORT || 3000);
app.use(logger('dev'));
app.use(bodyParser.json({limit: '100mb'}));
app.use(bodyParser.urlencoded({limit: '100mb'}));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/process', function(req, res) {
  var filename = req.body.filename;
  var recording = req.body.recording;
  
  var size = Math.floor(recording.length / 1e6);
  var file = fs.createWriteStream('./videos/' + filename, {flags: 'w'});
  var buffer = new Buffer(recording, 'base64');
  // Remove metadata header 15 bytes
  buffer = buffer.slice(15);
  
  file.write(buffer, {encoding: 'base64'}, function (err, res) {
    if (err) console.error(err);
    else console.log(`Saved ${filename} (${size}mb)`);
  });
  res.send(200, 'OK');
});


var server = app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + server.address().port);
});
