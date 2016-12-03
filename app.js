var express = require('express'),
    http                = require('http'),
    md5                 = require('MD5'),
    app                 = express(),
    bodyParser          = require('body-parser'),
    session             = require('express-session'),
    mysql               = require('mysql'),
    hitCounter          = 0,
    moment              = require('moment'),
    fs                  = require('fs'),
    configurationFile   = 'config/database.json',
    config              = JSON.parse(
                            fs.readFileSync(configurationFile)
                        ),
    settingFile         = 'config/settings.json',
    settings            = JSON.parse(
                            fs.readFileSync(settingFile)
                        ),
    connection          = mysql.createConnection({
                            host     : 'localhost',
                            user     : config.username,
                            password : config.password,
                            database : config.database
                        });

app.set('port', process.env.PORT || 8080);
app.set('view engine', 'ejs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({secret: settings.secret_token}));

app.locals.fromNow = function(date){
    return moment(date).fromNow();
};

//Homepage
app.get("/", function(req,res){
    hitCounter++;
    var sess = req.session;
    var sql = 'SELECT n.*, u.username from notes n JOIN users u ON n.user_id = u.id ORDER BY n.created_at DESC';
    connection.query(sql, function(err, rows, fields) {
        if (err) {
            throw err;
        }
        else {
            if (sess.id) {
                res.render("index", {title: 'Notes | Home', notes: rows, username: sess.username, id: sess.userId});
            } else {
                res.render("index", {title: 'Notes | Home', notes: rows, username: null, id: null});
            }
        }
    });

});

//Display all notes by the user
app.get("/user/:username", function(req,res){

    var username = req.params.username,
            sess = req.session;

    if(username != ''){
        var sql = 'SELECT n.*, u.username FROM notes n JOIN users u ON n.user_id = u.id WHERE  u.username = ?' +
                    ' ORDER BY n.updated_at DESC',
            params = [username],
            query = mysql.format(sql, params);
        connection.query(query, function (err, rows, fields) {
            if (err) {
                throw err;
            }
            else {
                if (sess.id) {
                    res.render("profile", {title: 'Notes | '+username, notes: rows, username: sess.username, id: sess.userId});
                } else {
                    res.render("profile", {title: 'Notes | '+username, notes: rows, username: null, id: null});
                }
            }
        });
    }else{
        res.redirect("/");
    }
});

//Registration page
app.get("/register", function(req,res){
    hitCounter++;
    res.render('register', {title: 'Notes | Register', error: null});
});

//Handle registration data
app.post("/register", function(req,res){
    hitCounter++;
    var username = req.body.username,
        email    = req.body.email,
        password = req.body.password,
        confirmPassword  = req.body.confirmpassword;

    username = username.charAt(0).toUpperCase()+username.slice(1);
    //Check if both passwords are same
    if(password != confirmPassword)
        res.render('register', {title: 'Notes | Register', error: 'Passwords do not match.'});
    else{

        var sql = 'SELECT * from users where email = ? OR username = ?',
            params = [email, password],
            query = mysql.format(sql, params);
        connection.query(query, function(err, rows, fields) {
            if (err) throw err;
            else{
                //If username/email already exists, show an error
                if(rows.length != 0)
                    res.render('register', {title: 'Notes | Register', error: 'Email/Username already exists.'});
                else{
                    //Otherwise add the user data to the database
                    var sql = 'INSERT INTO users(username,email,password,created_at) VALUES(?,?,?,NOW())',
                        params = [username, email, md5(password)],
                        query = mysql.format(sql, params);
                    connection.query(query, function(err, rows, fields) {
                        if (err) throw err;
                        else {
                            res.redirect('/login');
                        }
                    });
                }
            }
        });
    }
});

//Login page
app.get("/login", function(req,res){
    hitCounter++;
    res.render('login', {title: 'Notes | Login', msg: null});
});

//Handle authentication
app.post("/login", function(req,res){
    hitCounter++;
    var username = req.body.username,
        password = req.body.password;

    var sql = 'SELECT * from users where (email = ? OR username = ?) AND password = ?',
        params = [username, username, md5(password)],
        query = mysql.format(sql, params);
    connection.query(query, function(err, rows, fields) {
        if (err) throw err;
        else {
            //If email/username or password is incorrect
            if(rows.length == 0)
                res.render('login', {title: 'Notes | Login', msg: 'User not found!'});
            else{
                //redirect to homepage on successful authentication
                req.session.userId = rows[0].id;
                req.session.username = rows[0].username;
                req.session.email = rows[0].email;
                res.redirect("/");
            }
        }

    });
});

//Logs the user out by destroying the session
app.get('/logout',function(req,res) {
    hitCounter++;
    req.session.destroy(function (err) {
        if (err) {
            console.log(err);
        }
        else {
            res.redirect('/');
        }
    });
});


//Return JSON response containing a list of all the notes in the database
app.get("/list", function(req,res){
    hitCounter++;
    sess = req.session;
    var sql = 'SELECT a.*, b.username from notes a JOIN users b ON a.user_id = b.id ORDER BY a.created_at DESC';
    connection.query(sql, function(err, rows, fields) {
        if (err) throw err;
        else {
            res.json({'notes': rows});
        }
    });
});

//Provide UI for adding a note
app.get("/add", function(req,res){
    hitCounter++;
    if(req.session.userId)
        res.render("add-note", {title: 'Add note', error: null});
    else
        res.redirect("/login");
});

//Handle adding note
app.post("/add", function(req,res){
    hitCounter++;
    var sess = req.session;
    if(sess.userId){
        var notes_title = req.body.notes_title;
        var notes_desc = req.body.notes_description;
        if(notes_title == '' || notes_desc == ''){
            res.render("add-note", {title: 'Add note', error: "Note cannot be empty."});
        }else {
            var sql = 'INSERT INTO notes(user_id,title, description,created_at) VALUES(?,?,?,NOW())',
                params = [sess.userId, notes_title, notes_desc],
                query = mysql.format(sql, params);
            connection.query(query, function (err, rows, fields) {
                if (err) throw err;
                else {
                    res.redirect("/");
                }
            });
        }
    }
    else
        res.redirect("/login");
});

//Delete the note by the id received in the parameter
app.get("/delete/id/:id", function(req,res){
    hitCounter++;
    if(req.session.userId) {
        var noteId = req.params.id;
        var sql = 'DELETE FROM notes where id = ?',
            params = [noteId],
            query = mysql.format(sql, params);
        connection.query(query, function (err, rows, fields) {
            if (err) throw err;
            else {
                res.redirect("/");
            }
        });
    }else
        res.redirect("/login");
});

//Find the Note by the id and prepare for update
app.get("/edit/id/:id", function(req,res){
    hitCounter++;
    if(req.session.userId){
        var noteId = req.params.id;
        var sql = 'SELECT * FROM notes where id = ?',
        params = [noteId],
        query = mysql.format(sql, params);
        connection.query(query, function(err, rows, fields) {
            if (err) throw err;
            else {
                res.render("edit-note", {title: 'Edit Note', error: null, noteId: rows[0].id, note: rows[0].note});
            }
        });
    }else
        res.redirect("/login");

});

//Handle Note edit
app.post("/edit/id/:id", function(req,res){
    hitCounter++;
    if(req.session.userId){
        var noteId = req.params.id;
        var note = req.body.note;
        if(note == ''){
            res.render("edit-note", {title: 'Edit note', error: "Note cannot be empty."});
        }else {
            var sql = 'UPDATE notes SET note = ? WHERE id = ?',
                params = [note, noteId],
                query = mysql.format(sql, params);
                connection.query(query, function (err, rows, fields) {
                    if (err) throw err;
                    else {
                        res.redirect("/");
                    }
            });
        }
    }
    else
        res.redirect("/login");
});

//Provide UI for adding a note
app.get("/status", function(req,res){
    sess = req.session;
    res.render('status', {title: 'Notes | Status', hits: hitCounter, username: sess.username});
});


http.createServer(app).listen(app.get('port'), function(){
    console.log("Express server listening on port " + app.get('port'));
});
