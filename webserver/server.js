const sqlite3 = require("sqlite3").verbose();
var express = require('express');
var app = express();

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

// Enable HTML template middleware
app.engine('html', require('ejs').renderFile);

// Enable static CSS styles
app.use(express.static('styles'));

// reply to request with "Hello World!"
app.get('/', function (req, res) {
  const sql = "SELECT * FROM wav_file";
  db.all(sql, [], (err,rows) => {
    if (err) {
      return console.error(err.message);
    }
  res.render('index', { model: rows });
  });
});

// SQLite database connection
const db_name = "/data/sound_app/sound_app.db";
const db = new sqlite3.Database(db_name, err => {
  if (err) {
    return console.error(err.message);
  }
  console.log("Successful connection to the database.");
});

//start a server on port 80 and log its start to our console
var server = app.listen(80, function () {

  var port = server.address().port;
  console.log('Express server listening on port ', port);

});