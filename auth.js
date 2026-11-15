const express=require('express'); const bcrypt=require('bcryptjs'); const db=require('../database/db');
const router=express.Router();
router.get('/login',(req,res)=>res.render('auth/login',{error:null}));
router.post('/login',(req,res)=>{const {email,password}=req.body; const user=db.prepare('SELECT * FROM users WHERE email=?').get(email?.trim().toLowerCase()); if(!user||!bcrypt.compareSync(password||'',user.password)) return res.render('auth/login',{error:'Invalid email or password.'}); req.session.user={id:user.id,name:user.name,email:user.email,role:user.role}; res.redirect('/dashboard');});
router.get('/register',(req,res)=>res.render('auth/register',{error:null}));
router.post('/register',(req,res)=>{const {name,email,password}=req.body; if(!name||!email||!password) return res.render('auth/register',{error:'All fields are required.'}); try{const hash=bcrypt.hashSync(password,10); const r=db.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)').run(name.trim(),email.trim().toLowerCase(),hash); req.session.user={id:r.lastInsertRowid,name:name.trim(),email:email.trim().toLowerCase(),role:'member'}; res.redirect('/dashboard');}catch(e){res.render('auth/register',{error:'Email is already registered.'});}});
router.post('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/login')));
module.exports=router;
