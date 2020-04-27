'use strict'

var mongoose = require('mongoose');

var app = require('./app');
var port = 3800;

// Conexion a la base de datos
mongoose.connect('mongodb://localhost:27017/mean_social', (err, resp) => {
    if (err) throw err;
    console.log('Base de datos: \x1b[32m%s\x1b[0m', 'online');
    app.listen(port, () => {
        console.log('Express serve puerto 3000: \x1b[32m%s\x1b[0m', 'online');
    })
});



// mongoose.Promise = global.Promise;
// mongoose.connect('mongodb://localhost:27017/mean_social')
//     .then(() => {
//         console.log('Conexion a DB exitosa...');
//     })
//     .catch(err => console.log(err));