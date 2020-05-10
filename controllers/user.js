'use strict'
var bcrypt = require('bcrypt-nodejs');
var mongoosePaginate = require('mongoose-pagination');
var fs = require('fs');
var path = require('path');


var jwt = require('../services/jwt');
var User = require('../models/user');
var Follow = require('../models/follow');
var Publication = require('../models/publication');


function home(req, res) {
    res.status(200).send({
        message: "Hola mundo desde el servidor de NodeJS"
    });
}

function pruebas (req, res) {
    res.status(200).send({
        message: "Accion de pruebas en el servidor"
    });
}

function saveUser(req, res) {
    var params = req.body;
    var user = new User();
    if ( params.name && params.surname && params.nick && params.email && params.password ) {
        user.name = params.name;
        user.surname = params.surname;
        user.nick = params.nick;
        user.email = params.email;
        user.role = 'ROLE_USER';
        user.image = null;

        // Controlar usuarios duplicados
        User.find({ $or: [
                            {email: user.email.toLowerCase()},
                            {nick: user.nick.toLowerCase()}
                        ]}).exec((err, users) => {
                            if(err) return res.status(500).send({message: 'Error en la peticion de usuarios'});
                            if ( users && users.length >=1 ) {
                                return  res.status(200).send({message: 'El usuario que intentas registrar ya existe'});
                            } else {
                                // Cifra la password y me guarda los datos
                                bcrypt.hash(params.password, null, null, (err, hash) => {
                                    user.password = hash;
                                    user.save((err, userStore) => {
                                        if(err) return res.status(500).send({message: 'Error al guardar el usuario'});
                                        if( userStore ) {
                                            res.status(200).send({user: userStore});
                                        } else {
                                            res.status(404).send({message: 'No se a registrado el usuario'});
                                        }
                                    });
                                });
                            }
                        });
    } else {
        res.status(200).send({
            message: 'Envia todos los campos necesarios!'
        });
    }
}

function loginUser(req, res) {
    var params = req.body;
    var email = params.email;
    var password = params.password;

    User.findOne({email: email}, (err, user) => {
        if(err) return res.status(500).send({message: 'Error en la peticion'});
        if ( user ) {
            bcrypt.compare(password, user.password, (err, check) => {
                if ( check ) {
                    if ( params.getToken ) {
                        // generar y devolver token
                        return res.status(200).send({
                            token: jwt.createToken(user)
                        });
                    } else {
                        // devolver datos del usuario
                        user.password = ':P'
                        res.status(200).send({user});
                    }
                } else {
                    if(err) return res.status(404).send({message: 'El usuario no se a podido identificar'});
                }
            });
        } else {
            if(err) return res.status(404).send({message: 'El usuario no se a podido identificar!!'});
        }
    });
}

function getUser(req, res) {
    var userId = req.params.id;
  
    User.findById(userId, (err, user) => {
        if (!user) return res.status(404).send({message: "User Not Found."});
        if (err) return res.status(500).send({message: "Request Error."});
  
        followThisUser(req.user.sub, userId).then((value) => {
            return res.status(200).send({
                user,
                following: value.following,
                followed: value.followed
            });
        });
    });
 }
  
 async function followThisUser(identity_user_id, user_id) {
    var following = await Follow.findOne({ user: identity_user_id, followed: user_id }).exec()
        .then((following) => {
            return following;
        })
        .catch((err) => {
            return handleError(err);
        });
    var followed = await Follow.findOne({ user: user_id, followed: identity_user_id }).exec()
        .then((followed) => {
            return followed;
        })
        .catch((err) => {
            return handleError(err);
        });
  
    return {
        following: following,
        followed: followed
    };
 }

// Devolver un listado de usuarios paginados
function getUsers(req,res){
    var user_id = req.user.sub;
     
    var page = 1;
    if(req.params.page){
    page = req.params.page;
    }
    var itemsPerPage = 5;
     
    User.find().sort('_id').paginate(page,itemsPerPage,(err,users,total)=>{
    if(err) return res.status(500).send({message:"Error en la peticion",err});
    if(!users) return res.status(404).send({message:"No hay Usuarios"});
     
    followUserIds(user_id).then((response)=>{
    return res.status(200).send({message:"Resultados",users,users_following: response.following,users_followed: response.followed,total,pages: Math.ceil(total/itemsPerPage)});
    });
    });
    }
     
    async function followUserIds(user_id){
     
    var following = await Follow.find({'user':user_id}).select({'_id':0,'__v':0,'user':0}).exec()
    .then((follows) => {
    return follows;
    })
    .catch((err) => {
    return handleError(err);
    });
    var followed = await Follow.find({followed:user_id}).select({'_id':0,'__v':0,'followed':0}).exec()
    .then((follows) => {
    return follows;
    })
    .catch((err) => {
    return handleError(err);
    });
     
    var following_clean = [];
     
    following.forEach((follow)=>{
    following_clean.push(follow.followed);
    });
    var followed_clean = [];
     
    followed.forEach((follow)=>{
    followed_clean.push(follow.user);
    });
    //console.log(following_clean);
    return {following: following_clean,followed:followed_clean}
     
    }
    const getCounters = (req, res) => {
        let userId = req.user.sub;
        if(req.params.id){
            userId = req.params.id;      
        }
        getCountFollow(userId).then((value) => {
            return res.status(200).send(value);
        })
    }
     
    const getCountFollow = async (user_id) => {
        try{
            // Lo hice de dos formas. "following" con callback de countDocuments y "followed" con una promesa
            let following = await Follow.countDocuments({"user": user_id},(err, result) => { return result });
            let followed = await Follow.countDocuments({"followed": user_id}).then(count => count);
            let publications = await Publication.countDocuments({"user": user_id}).then(count => count);
     
            return { following, followed, publications }
            
        } catch(e){
            console.log(e);
        }
    }
 
// Edicion de datos e usuario
function updateUser(req, res) {
    var userId = req.params.id;
    var update = req.body;
    // borrar la propiedad password
    delete update.password;

    if ( userId != req.user.sub ) {
        return res.status(500).send({message: 'No tienes permiso para actualizar los datos del usuario'});
    }

    User.findByIdAndUpdate( userId, update, {new: true}, (err, userUpdated) => {
        if (err) return res.status(500).send({message: 'Error en la peticion'});
        if (!userUpdated) return res.status(404).send({message: 'No se a podido actualizar el usuario'});
        return res.status(200).send({user: userUpdated});
    });
}

function uploadImage(req, res){
    var userId = req.params.id;
 
    if(req.files){
        var file_path = req.files.image.path;
        console.log(file_path);
        
        var file_split = file_path.split('\\');
        console.log(file_split);
 
        var file_name = file_split[2];
        console.log(file_name);
 
        var ext_split = file_name.split('\.');
        console.log(ext_split);
 
        var file_ext = ext_split[1];
        console.log(file_ext);
 
        if(userId != req.user.sub){
            return removeFilesOfUploads(res, file_path, 'No tienes permiso para actualizar los datos del usuario');
        }
 
        if(file_ext == 'png' || file_ext == 'jpg' || file_ext == 'jpeg' || file_ext == 'gif'){
             
             // Actualizar documento de usuario logueado
             User.findByIdAndUpdate(userId, {image: file_name}, {new:true}, (err, userUpdated) =>{
                if(err) return res.status(500).send({message: 'Error en la petición'});
 
                if(!userUpdated) return res.status(404).send({message: 'No se ha podido actualizar el usuario'});
 
                return res.status(200).send({user: userUpdated});
             });
 
        }else{
            return removeFilesOfUploads(res, file_path, 'Extensión no válida');
        }
 
    }else{
        return res.status(200).send({message: 'No se han subido imagenes'});
    }
}
 
function removeFilesOfUploads(res, file_path, message){
    fs.unlink(file_path, (err) => {
        return res.status(200).send({message: message});
    });
}
 
function getImageFile(req, res){
    var image_file = req.params.imageFile;
    var path_file = './uploads/users/'+image_file;
 
    fs.exists(path_file, (exists) => {
        if(exists){
            res.sendFile(path.resolve(path_file));
        }else{
            res.status(200).send({message: 'No existe la imagen...'});
        }
    });
}
module.exports = {
    home,
    pruebas,
    saveUser,
    loginUser,
    getUser,
    getUsers,
    getCounters,
    updateUser,
    uploadImage,
    getImageFile
}