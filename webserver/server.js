const sqlite3 = require("sqlite3").verbose(); var express = require('express'); var app = express(); const {env} = require('process'); var fs = require('fs');

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

var wav_path = env.WAV_PATH;
if (!wav_path) {
  wav_path = "/data/sound_app/";
}
var db_name = env.DB_PATH;
if (!db_name) {
  db_name = "/data/sound_app/sound_app.db";
}
var label_file = env.LABEL_FILE;
if (!label_file) {
  label_file = "/data/sound_app/labels.txt";
}
var master_node = env.MASTER_NODE;
if (!master_node) {
  master_node = "unknown";
}
var uuid = env.RESIN_DEVICE_UUID;

var ready_rows = 0;

var Minio = require('minio')

var minioClient = new Minio.Client({
    endPoint: master_node + '.balena-devices.com',
    port: 80,
    useSSL: false,
    accessKey: 'minio',
    secretKey: 'minio123'
});

// Enable HTML template middleware
app.engine('html', require('ejs').renderFile);

// Enable static CSS styles
app.use(express.static('styles'));

// Enable access to wav files
app.use("/public", express.static(wav_path));

// For processing forms
app.use(express.urlencoded({ extended: true}))

// Read in label file
var labels_all = fs.readFileSync(label_file).toString('utf-8');
var labels = labels_all.split("\n");

function getName(uid, callback){
  var query = "SELECT filename FROM wav_file WHERE current_status = 'ready'";
  db.all(query, function (err, rows) {
    if(err){
        console.log(err);
    }else{
        callback(rows.length);
    }
  });
}

function print(name) {
  console.log("print:",name);
  ready_rows = name;
}



function testt() {
  return 50;
}

function getSQL(filter, srtid) {
  //console.log("here", filter, srtid);
  var sql = "SELECT rowid, timestamp_created, interpreter_class, interpreter_class2, interpreter_certainty, interpreter_certainty2, current_status, filename FROM wav_file";
  //console.log("S1:",sql);
  if (filter != "all" || (!filter)) {
    if (filter === undefined || filter == '') {
      // do nothing
      //console.log(" ");
    } else {
    sql = sql + " WHERE current_status = '" + filter + "'";
    }
  }
 //console.log("S2",sql);
  switch (srtid) {
    case "1":
      sql = sql + " ORDER BY timestamp_created";
      break;
    case "2":
      sql = sql + " ORDER BY current_status";
      break;
    case "3":
      sql = sql + " ORDER BY interpreter_class";
      break;
  }
  //console.log("SQL3: ", sql);
  return sql;


}

// reply to home page request
app.get('/', function (req, res) {
  getName(0, print);
  console.log("GETSQL: ",  getSQL(req.query.filter, req.query.srtid));
  db.all(getSQL(req.query.filter, req.query.srtid), [], (err,rows) => {
    if (err) {
      return console.error(err.message);
    }
  res.render('index', { model: rows, srtid: req.query.srtid, fil: req.query.filter, frmErr: 'NA', labels: labels, readyCount: ready_rows });
  });
});

app.post('/', (req, res) => {
  let frmErr = "NA";
  let filename = "";
  let bucket = uuid.substring(0, 7);
  let metaData = "";
  console.log('Form submitted: ', req.body);
  let sql = "UPDATE wav_file SET ";
  // Validate form input
  if (req.body.hidFormName == "id01") {

    if (req.body.predictClass == "other" && (req.body.txtDescription === undefined || req.body.txtDescription == "")) {
      frmErr = "<h4 style='color:red;'>Description is required. File not uploaded!</h4>";
    } else {
        // upload details form posted
        // update db here
        const heard = [req.body.predictClass, req.body.txtDescription, req.body.txtNotes, req.body.hidWavID1];
        sql = sql + "user_class = ?, user_description = ?, user_notes = ?, current_status = 'ready', timestamp_ready = datetime('now') WHERE (rowid = ?)";
        console.log("Upload SQL: ", sql);
        db.run(sql, heard, err => {
          if (err) {
            frmErr = err.message;
          }
        });
        // upload file
        if (frmErr != "NA") {
          frmErr = "<h4 style='color:red;'>Error uploading file: " + frmErr + "</h4>";
        } else {
          frmErr = "<h4 style='color:green;'>File successfully uploaded.</h4>";
        }
    }  // end else blank description

  } else {
      if (req.body.hidFormName == "id02") {
        // delete file form posted
        // update db
        sql = sql + "timestamp_deleted = datetime('now'), current_status = 'deleted' WHERE (rowid = " + req.body.hidWavID2 + ")";
        console.log("Delete SQL: ", sql);
        db.run(sql, err => {
          if (err) {
            frmErr = err.message;
          }
        });
        // delete file
        fs.unlink(wav_path + req.body.hidWavFile, function (err) {
          if (err) {
            frmErr = frmErr + " " + err.message;
          }
        });
        if (frmErr != "NA") {
          frmErr = "<h4 style='color:red;'>Error deleting file: " + frmErr + "</h4>";
        } else {
          frmErr = "<h4 style='color:green;'>File successfully deleted.</h4>";
        }
      }  else {
        // Upload form posted
        let row_id = 0;
        if (master_node != "unknown") {
          sql = "SELECT rowid, filename, user_class, user_description FROM wav_file WHERE current_status = 'ready'";
          db.all(sql, [], (err,rows) => {
          if (err) {
            return console.error(err.message);
          }
            rows.forEach((row) => {
              // for each row in 'ready' status:
              // upload to master
              filename = row.filename;
              row_id = row.rowid
              let metaData = {
                'Content-Type': 'application/octet-stream',
                'x-amz-meta-rowid': row_id,
                'x-amz-meta-class': row.user_class,
                'x-amz-meta-descrip': row.user_description
              }
              minioClient.fPutObject(bucket, filename, wav_path + filename, metaData, function(err, etag) {
              if (err) {
                frmErr = frmErr + " " + filename;
                return console.log(err)
              }
              console.log('File uploaded successfully.')
              });
              // update database
               sql = "UPDATE wav_file SET timestamp_deleted = datetime('now'), timestamp_uploaded = datetime('now'), current_status = 'uploaded' WHERE (rowid = " + row_id + ")";
               console.log("Delete post upload SQL: ", sql);
               db.run(sql, err => {
                 if (err) {
                   frmErr = frmErr + " " + err.message;
                 }
               });
               // delete file
               fs.unlink(wav_path + row.filename, function (err) {
                 if (err) {
                   frmErr = frmErr + " " + err.message;
                 }
               });

            });

            if (frmErr != "NA") {
              frmErr = "<h4 style='color:red;'>One or more errors during file upload: " + frmErr + "</h4>";
            } else {
              frmErr = "<h4 style='color:green;'>File successfully uploaded.</h4>";
            }

          });

        } else {
         // master node not set
         frmErr = "<h4 style='color:red;'>Master node unknown. You must set value in balena dashboard.</h4>";
        }

      }
  }

  // This is redundant - TODO: use AJAX to convert to a full SPA and elimiate POSTs
  getName(0, print);
  db.all(getSQL(req.query.filter, req.query.srtid), [], (err,rows) => {
    if (err) {
      return console.error(err.message);
    }
  res.render('index', { model: rows, srtid: req.query.srtid, fil: req.query.filter, frmErr: frmErr, labels: labels, readyCount: ready_rows });
  });
})

// SQLite database connection
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
