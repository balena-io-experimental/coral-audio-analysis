const sqlite3 = require("sqlite3").verbose();
const express = require('express');
const app = express();
const { env } = require('process');
const fs = require('fs');
const Minio = require('minio');
const util = require('util');

const dbAll = util.promisify(db.all)
const dbRun = util.promisify(db.run)

app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

let wav_path = env.WAV_PATH || "/data/sound_app/";
let db_name = env.DB_PATH || "/data/sound_app/sound_app.db";
var label_file = env.LABEL_FILE || "/data/sound_app/labels.txt";
var master_node = env.MASTER_NODE || "unknown";

let minio_access_key = env.MINIO_ACCESS_KEY;
let minio_secret_key = env.MINIO_SECRET_KEY;
let uuid = env.RESIN_DEVICE_UUID;
let short_uuid = uuid.substring(0, 8);
let menu = [ short_uuid, '#', 'Master', `https://${master_node}.balena-devices.com` ];
let menu_items = env.MENU_ITEMS;
if (menu_items) {
  menu = JSON.parse("[" + string.split() + "]");
}
let ready_rows = 0;
let upload_enabled = "OK";

if (!minio_access_key || !minio_secret_key) {
  upload_enabled = "No Minio credentials set";
} else {
  try {
    var minioClient = new Minio.Client({
      endPoint: master_node + '.balena-devices.com',
      port: 80,
      useSSL: false,
      accessKey: minio_access_key,
      secretKey: minio_secret_key
    });
  } catch (error) {
    upload_enabled = "Minio error";
    console.log("Error creating minio client: ", error);
  }
}

// Enable HTML template middleware
app.engine('html', require('ejs').renderFile);

// Enable static CSS styles
app.use(express.static('styles'));

// Enable access to wav files
app.use("/public", express.static(wav_path));

// For processing forms
app.use(express.urlencoded({ extended: true }))

// Read in label file
try {
  var labels_all = fs.readFileSync(label_file).toString('utf-8');
  var labels = labels_all.split("\n");
} catch (error) {
  console.log("Error reading label file: ", error);
  upload_enabled = "No label file";
}

async function getReadyCount () {
  var query = "SELECT filename FROM wav_file WHERE current_status = 'ready'";
  let rows = await dbAll(query);
  return rows.length
}

async function doUpload () {
  let sql = "";
  let frmErr = "NA";
  if (master_node != "unknown") {
    try {
      sql = "SELECT rowid, filename, user_class, user_description FROM wav_file WHERE current_status = 'ready'";
      let rows = await dbAll(query)
      for (const row of rows) {
        await doUploadTasks(row)
        console.log("Completed one doupload2");
      }
    } catch (error) {
      frmErr = frmErr + err.message;
      console.error(err.message);
    }
    if (frmErr != "NA") {
      frmErr = "<h4 style='color:red;'>One or more errors during file upload: " + frmErr + "</h4>";
    } else {
      frmErr = "<h4 style='color:green;'>File(s) successfully uploaded.</h4>";
    }
  } else {
    // master node not set
    frmErr = "<h4 style='color:red;'>Master node unknown. You must set value in balena dashboard.</h4>";
  }
}


async function doUploadTasks (row) {

  let bucket = uuid.substring(0, 7);

  // upload to master
  let filename = row.filename;
  let row_id = row.rowid;
  let metaData = {
    'Content-Type': 'application/octet-stream',
    'x-amz-meta-rowid': row_id,
    'x-amz-meta-class': row.user_class,
    'x-amz-meta-descrip': row.user_description
  }

  // Upload
  console.log("uploading: ", filename);
  try {
    url = await minioClient.fPutObject(bucket, filename, wav_path + filename, metaData);
  } catch (error) {
    console.log('minio upload catch');
  }
  console.log('File ' + filename + ' uploaded successfully.');

  // Update db
  row_id = row.rowid;
  sql = "UPDATE wav_file SET timestamp_deleted = datetime('now'), timestamp_uploaded = datetime('now'), current_status = 'uploaded' WHERE (rowid = " + row_id + ")";
  console.log("post upload SQL: ", sql);
  try {
    await dbRun(sql)
  } catch (err) {
    frmErr = frmErr + " " + err.message;
  }

  // Delete file
  console.log("deleting file ", row.filename);
  fs.unlinkSync(wav_path + row.filename, function (err) {
    if (err) {
      frmErr = frmErr + " " + err.message;
    }
  });
}



function getSQL (filter, srtid) {

  var sql = "SELECT rowid, timestamp_created, interpreter_class, interpreter_class2, interpreter_certainty, interpreter_certainty2, current_status, filename, threshold FROM wav_file";

  switch (filter) {
    case "filter1":
      sql = sql + " WHERE current_status = 'evaluated' OR current_status = 'ready' OR current_status = 'created'";
      break;
    case "filter2":
      sql = sql + " WHERE current_status = 'uploaded'";
      break;
    case "filter3":
      sql = sql + " WHERE current_status = 'deleted'";
      break;
    default:
      sql = sql + " WHERE current_status = 'evaluated' OR current_status = 'ready' OR current_status = 'created'";
  }
  switch (srtid) {
    case "1":
      sql = sql + " ORDER BY timestamp_created DESC";
      break;
    case "2":
      sql = sql + " ORDER BY current_status";
      break;
    case "3":
      sql = sql + " ORDER BY interpreter_class";
      break;
    default:
      sql = sql + " ORDER BY timestamp_created DESC";
  }
  return sql;
}

// reply to home page request
app.get('/', async function (req, res) {
  ready_rows = getReadyCount();
  console.log("GETSQL for home page render: ", getSQL(req.query.filter, req.query.srtid));
  let rows = await dbAll(getSQL(req.query.filter, req.query.srtid), [])
  res.render('index', { model: rows, srtid: req.query.srtid, fil: req.query.filter, frmErr: 'NA', labels: labels, readyCount: ready_rows, rm: "false", upload_enabled: upload_enabled, menuItems: menu });
});

app.post('/', async (req, res) => {
  let frmErr = "NA";
  console.log('Form submitted: ', req.body);
  let sql = "UPDATE wav_file SET ";
  // Validate form input
  if (req.body.hidFormName == "id01") {

    if (req.body.predictClass == "other" && (req.body.txtDescription === undefined || req.body.txtDescription == "")) {
      frmErr = "<h4 style='color:red;'>Description is required. File not uploaded!</h4>";
    } else {
      // upload details form posted
      // update db here
      const heard = [ req.body.predictClass, req.body.txtDescription, req.body.txtNotes, req.body.hidWavID1 ];
      sql = sql + "user_class = ?, user_description = ?, user_notes = ?, current_status = 'ready', timestamp_ready = datetime('now') WHERE (rowid = ?)";
      console.log("Upload SQL: ", sql);
      try {
        await dbRun(sql, heard)
      } catch (err) {
        frmErr = err.message;
      }
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
      try {
        await dbRun(sql)
      } catch (err) {
        frmErr = err.message;
      }
      // delete file
      fs.unlinkSync(wav_path + req.body.hidWavFile, function (err) {
        if (err) {
          frmErr = frmErr + " " + err.message;
        }
      });
      if (frmErr != "NA") {
        frmErr = "<h4 style='color:red;'>Error deleting file: " + frmErr + "</h4>";
      } else {
        frmErr = "<h4 style='color:green;'>File successfully deleted.</h4>";
      }
    } else {
      // Upload form posted
      await doUpload()
      console.log("moving on...");
    }
  }

  res.redirect(req.get('referer'));
});

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
