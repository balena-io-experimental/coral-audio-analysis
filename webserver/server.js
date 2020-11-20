const sqlite3 = require("sqlite3").verbose();
const express = require('express');
const app = express();
const {env} = require('process');
const fs = require('fs');

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
var ready_rows = 0;
var table_rows = 0;
var form_errors = "NA";
var Minio = require('minio')
var upload_enabled = "OK";

if (!minio_access_key || !minio_secret_key) {
  upload_enabled = "No Minio credentials set";
} else {
  try {
    var minioClient = new Minio.Client({
      endPoint: master_node + '.balena-devices.com',
      port: 80,
      region: 'myregion',
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
app.use(express.urlencoded({ extended: true}))

// Read in label file
var labels = [];
try {
  fs.readFileSync(label_file).toString().split("\n").forEach(function(line, index, arr) {
    if (index === arr.length - 1 && line === "") { return; }
    labels.push(line);
  });
} catch (error) {
  console.log("Error reading label file: ", error);
  upload_enabled = "No label file";
}
console.log("Read in", labels.length, "labels:");
console.log(labels);

function getReadyCount(uid, callback){
  var query = "SELECT filename FROM wav_file WHERE current_status = 'ready'";
  db.all(query, function (err, rows) {
    if(err){
        console.log(err);
    }else{
        callback(rows.length);
    }
  });
}

function cb_readyCount(rowcount) {
  //console.log("print:",rowcount);
  ready_rows = rowcount;
}


async function doUpload() {
  return new Promise( async (resolve, reject) => {
    let row_id = 0;
    let sql = "";
    let frmErr = "NA";
    form_errors = "";
    let metaData = "";
    if (master_node != "unknown") {
      sql = "SELECT my_rowid, filename, user_class, user_class_id, user_description FROM wav_file WHERE current_status = 'ready'";
      db.all(sql, [], async (err,rows) => {
       if (err) {
         form_errors = formErrors + ", " + err.message;
         console.error(err.message);
       }
       for (const row of rows) {
         await doUploadTasks(row)
         //console.log("Completed one doUploadTasks");
       }
       if (frmErr != "NA") {
         frmErr = "<h4 style='color:red;'>One or more errors during file upload: " + form_errors + "</h4>";
       } else {
         frmErr = "<h4 style='color:green;'>File(s) successfully uploaded.</h4>";
       }
       resolve(frmErr);
      });  // end outer db;

    } else {
      // master node not set
      frmErr = "<h4 style='color:red;'>Master node unknown. You must set value in balena dashboard.</h4>";
      reject(frmErr);
    }
  });  // end promise
}


async function doUploadTasks(row) {

  var filename = "";
  let p = new Promise(async (resolve, reject) => {
    let sql = "";
    let bucket = "uploads";

    // upload to master
    filename = uuid.substring(0, 7) + "-" + row.user_class_id + "-" + row.filename;
    let row_id = row.my_rowid;
    let metaData = {
      'Content-Type': 'application/octet-stream',
      'x-amz-meta-rowid': row_id,
      'x-amz-meta-class': row.user_class,
      'x-amz-meta-descrip': row.user_description
    }
    console.log("uploading: ", filename);
    try {
        url = await minioClient.fPutObject(bucket, filename, wav_path + row.filename, metaData);
    } catch(error) {
        console.log('minio upload error: ' + error.message);
        form_errors = form_errors + ", " + error.message;
        resolve(10);
    }
    //console.log('File ' + filename + ' uploaded successfully.');
    resolve(10);
  });

  return p.then((result) => {
    console.log(result);
    return new Promise((resolve, reject) => {
      row_id = row.my_rowid;
      sql = "UPDATE wav_file SET timestamp_deleted = datetime('now'), timestamp_uploaded = datetime('now'), current_status = 'uploaded', remote_filename = '" + filename + "' WHERE (my_rowid = " + row_id + ")";
      console.log("post upload SQL: ", sql);
      db.run(sql, err => {
        if (err) {
          form_errors = form_errors + ", " + err.message;
        }
      });
      resolve(20);
      });
  }).then((result) => {
    //console.log(result);
    return new Promise((resolve, reject) => {
      //console.log("deleting file ", row.filename);
      fs.unlinkSync(wav_path + row.filename, function (err) {
      if (err) {
        form_errors = form_errors + ", " + err.message;
      }
    });
    resolve(30);
    });
  }).then(result => console.log(result));

}

async function buildTable(req) {
  return new Promise( async (resolve, reject) => {
    let my_table = "";
    let row_html = "";
    db.all(getSQL(req.query.filter, req.query.srtid), [], async (err,rows) => {
      //console.log("buildTable SQL: ", getSQL(req.query.filter, req.query.srtid));
      if (err) {
        return console.error(err.message);
      }
      table_rows = rows.length;
      for (const row of rows) {
        row_html = await buildTableHTML(row);
        my_table = my_table + row_html
        //console.log("table row: ", row.filename);
      }  // end for
    resolve(my_table);
    });  // end db
  });  // end promise
}

async function buildTableHTML(row) {
  return new Promise(async (resolve, reject) => {

    let my_table = "";
    my_table = my_table + "<tr>" +
    "<td style='vertical-align: middle;'><div class='tooltip'>" + row.timestamp_created + "<span class='tooltiptext'>" +  row.filename + "</span></div></td>" +
    "<td style='vertical-align: middle;'>" + row.current_status + "</td><td style='vertical-align: middle;'>"
    if (row.interpreter_class !== null) {
      my_table = my_table + row.interpreter_class;
    } else {
      my_table = my_table + "&nbsp;";
    }

    if (row.interpreter_certainty !== null) {
      if (row.interpreter_certainty >= row.threshold) {
        my_table = my_table + "<span style='font-weight: bold;'> (" + row.interpreter_certainty + "%)</span>";
      } else {
        my_table = my_table + " (" + row.interpreter_certainty + "%)";
      }
    }

    my_table = my_table + "</td><td style='vertical-align: middle;'>";
    if (row.interpreter_class2 !== null) {
      my_table = my_table + row.interpreter_class2
    } else {
       my_table = my_table +  "&nbsp;"
    }

    if (row.interpreter_certainty2 !== null) {
      my_table = my_table + " (" + row.interpreter_certainty2 + "%)"
    }

    my_table = my_table + "</td><td style='vertical-align: bottom;'>"

    if (row.current_status != "deleted" && row.current_status != "uploaded") {
      my_table = my_table + "<audio controls><source src='/public/" + row.filename + "'></audio> &nbsp;"
    }

    my_table = my_table + "</td><td style='vertical-align: middle;'>"

    if (row.current_status != "deleted" && row.current_status != "uploaded") {
      my_table = my_table + "<a class='w3-button w3-circle w3-small w3-red' onclick=\"modalShow('id02'," + row.my_rowid + ", '" +  row.interpreter_class_id + "', '" + row.filename + "')\"><i class='fa fa-trash'></i></a> &nbsp;&nbsp;"
    }

    if (row.current_status == "evaluated") {
      my_table = my_table + "<a class='w3-button w3-circle w3-small w3-blue' onclick=\"modalShow('id01'," + row.my_rowid + ", '" +  row.interpreter_class_id + "', '" + row.filename + "')\"><i class='fa fa-cloud-upload'></i></a>"
    }

    my_table = my_table + "</td></tr>"

    resolve(my_table);
    });
}

async function buildExport(req) {
  return new Promise( async (resolve, reject) => {
    let my_table = "";
    let row_html = "";
    let sql = "SELECT * FROM wav_file";
    if (req.query.startid) {
      sql = sql + " WHERE my_rowid >= " + req.query.startid;
    }
    sql = sql + " ORDER BY my_rowid";
    db.all(sql, [], async (err,rows) => {
      console.log("buildExport SQL: ", sql);
      if (err) {
        return console.error(err.message);
      }
      my_table = `{  "files": [`
      for (const row of rows) {
        row_html = await buildExportJSON(row);
        my_table = my_table + row_html
        console.log("table row: ", row.filename);
      }  // end for
      my_table = my_table + "]  }"
    resolve(my_table);
    });  // end db
  });  // end promise
}

async function buildExportJSON(row) {
  return new Promise(async (resolve, reject) => {

    let my_table = "{";
    my_table = my_table + '"my_rowid": "' + row.my_rowid + '",'
    my_table = my_table + '"current_status": "' + row.current_status + '",'
    my_table = my_table + '"timestamp_created": "' + row.timestamp_created + '",'
    my_table = my_table + '"threshold": "' + row.threshold + '",'
    my_table = my_table + '"interpreter_class": "' + row.interpreter_class + '",'
    my_table = my_table + '"interpreter_class2": "' + row.interpreter_class2 + '",'
    my_table = my_table + '"interpreter_certainty": "' + row.interpreter_certainty + '",'
    my_table = my_table + '"interpreter_certainty2": "' + row.interpreter_certainty2 + '",'
    my_table = my_table + '"interpreter_class_id": "' + row.interpreter_class_id + '",'
    my_table = my_table + '"interpreter_class2_id": "' + row.interpreter_class2_id + '",'
    my_table = my_table + '"certainty_threshold": "' + row.certainty_threshold + '",'
    my_table = my_table + '"classify_duration": "' + row.classify_duration + '",'
    my_table = my_table + '"timestamp_uploaded": "' + row.timestamp_uploaded + '",'
    my_table = my_table + '"remote_filename": "' + row.remote_filename + '",'
    my_table = my_table + '"user_class": "' + row.user_class + '",'
    my_table = my_table + '"user_class_id": "' + row.user_class_id + '",'
    my_table = my_table + '"user_description": "' + row.user_description + '",'
    my_table = my_table + '"user_notes": "' + row.user_notes + '",'

    my_table = my_table + "}"

    resolve(my_table);
    });
}

function getSQL(filter, srtid) {

  var sql = "SELECT my_rowid, timestamp_created, interpreter_class, interpreter_class_id, interpreter_class2, interpreter_certainty, interpreter_certainty2, current_status, filename, threshold FROM wav_file";

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
app.get('/', function (req, res) {
  getReadyCount(0, cb_readyCount);
  //console.log("GETSQL for home page render: ",  getSQL(req.query.filter, req.query.srtid));
  db.all(getSQL(req.query.filter, req.query.srtid), [], (err,rows) => {
    if (err) {
      return console.error(err.message);
    }
  res.render('index', { model: rows, srtid: req.query.srtid, fil: req.query.filter, frmErr: 'NA', labels: labels, readyCount: ready_rows, rm: "false", upload_enabled: upload_enabled, menuItems: menu });
  });
});

// reply to table request for AJAX calls
app.get('/table', async function (req, res) {
  let my_table = "";
  //console.log("Get table");
  my_table = await buildTable(req);
  //console.log("my_table: ", my_table);
  //console.log("table moving on...");
  let rr = "      " + table_rows;  // 6 spaces
  res.send(rr.substring(rr.length - 6, rr.length) + my_table);
});

// reply to export request for JSON export
app.get('/export', async function (req, res) {
  let my_table = "";
  my_table = await buildExport(req);
  res.send(my_table);
});

app.post('/', async (req, res, next) => {
  let frmErr = "NA";
  let filename = "";
  //console.log('Form submitted: ', req.body);
  let sql = "UPDATE wav_file SET ";
  // Validate form input
  if (req.body.hidFormName == "id01") {

    if (req.body.predictClass == "other" && (req.body.txtDescription === undefined || req.body.txtDescription == "")) {
      frmErr = "<h4 style='color:red;'>Description is required. File not uploaded!</h4>";
    } else {
        // upload details form posted
        // update db here
        const heard = [req.body.predictClass, labels[req.body.predictClass], req.body.txtDescription, req.body.txtNotes, req.body.hidWavID1];
        sql = sql + "user_class_id = ?, user_class = ?, user_description = ?, user_notes = ?, current_status = 'ready', timestamp_ready = datetime('now') WHERE (rowid = ?)";
        //console.log("Upload SQL: ", sql);
        db.run(sql, heard, err => {
          if (err) {
            frmErr = err.message;
          }
        });
        // upload file
        if (frmErr != "NA") {
          frmErr = "<h4 style='color:red;'>Error tagging file for upload: " + frmErr + "</h4>";
        } else {
          frmErr = "<h4 style='color:green;'>File successfully tagged for upload.</h4>";
        }
    }  // end else blank description

  } else {
      if (req.body.hidFormName == "id02") {
        // delete file form posted
        // update db
        sql = sql + "timestamp_deleted = datetime('now'), current_status = 'deleted' WHERE (my_rowid = " + req.body.hidWavID2 + ")";
        //console.log("Delete SQL: ", sql);
        db.run(sql, err => {
          if (err) {
            frmErr = err.message;
          }
        });
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
      }  else {
        // Upload form posted
        frmErr = await doUpload()
        //console.log("moving on...");
      }
  }

  getReadyCount(0, cb_readyCount);
  //console.log("GETSQL for home page render after POST: ",  getSQL(req.query.filter, req.query.srtid));
  db.all(getSQL(req.query.filter, req.query.srtid), [], (err,rows) => {
    if (err) {
      return console.error(err.message);
    }
  res.render('index', { model: rows, srtid: req.query.srtid, fil: req.query.filter, frmErr: frmErr, labels: labels, readyCount: ready_rows, rm: "false", upload_enabled: upload_enabled, menuItems: menu });
  });
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
