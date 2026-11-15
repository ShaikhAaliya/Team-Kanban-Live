const express=require('express');
const db=require('../database/db');
const {requireAdmin}=require('../middleware/admin');
const router=express.Router();

router.get('/admin',requireAdmin,(req,res)=>{
 const users=db.prepare(`SELECT u.id,u.name,u.email,u.role,u.created_at,COUNT(DISTINCT pm.project_id) project_count,COUNT(DISTINCT t.id) task_count FROM users u LEFT JOIN project_members pm ON pm.user_id=u.id LEFT JOIN tasks t ON t.assigned_to=u.id GROUP BY u.id ORDER BY u.created_at DESC`).all();
 const projects=db.prepare(`SELECT p.id,p.name,p.created_at,u.name owner,COUNT(DISTINCT pm.user_id) member_count,COUNT(DISTINCT t.id) task_count,SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) done_count FROM projects p JOIN users u ON u.id=p.owner_id LEFT JOIN project_members pm ON pm.project_id=p.id LEFT JOIN tasks t ON t.project_id=p.id GROUP BY p.id ORDER BY p.created_at DESC`).all();
 const totals=db.prepare(`SELECT (SELECT COUNT(*) FROM users) users,(SELECT COUNT(*) FROM projects) projects,(SELECT COUNT(*) FROM tasks) tasks,(SELECT COUNT(*) FROM tasks WHERE status='done') done,(SELECT COUNT(*) FROM tasks WHERE due_date IS NOT NULL AND due_date < date('now') AND status!='done') overdue`).get();
 const status=db.prepare(`SELECT status,COUNT(*) count FROM tasks GROUP BY status`).all();
 const priority=db.prepare(`SELECT priority,COUNT(*) count FROM tasks GROUP BY priority`).all();
 const recent=db.prepare(`SELECT a.*,u.name user_name,p.name project_name,t.title task_title FROM activity_logs a JOIN users u ON u.id=a.user_id JOIN projects p ON p.id=a.project_id LEFT JOIN tasks t ON t.id=a.task_id ORDER BY a.created_at DESC LIMIT 15`).all();
 res.render('admin/index',{users,projects,totals,status,priority,recent});
});

router.post('/admin/users/:id/role',requireAdmin,(req,res)=>{
 const id=Number(req.params.id); if(id===req.session.user.id) return res.redirect('/admin');
 const role=['admin','member'].includes(req.body.role)?req.body.role:'member';
 db.prepare('UPDATE users SET role=? WHERE id=?').run(role,id); res.redirect('/admin');
});

router.post('/admin/users/:id/delete',requireAdmin,(req,res)=>{
 const id=Number(req.params.id); if(id===req.session.user.id) return res.redirect('/admin');
 db.prepare('DELETE FROM users WHERE id=?').run(id); res.redirect('/admin');
});

router.get('/api/admin/analytics',requireAdmin,(req,res)=>{
 const monthly=db.prepare(`SELECT substr(created_at,1,7) month,COUNT(*) count FROM tasks GROUP BY substr(created_at,1,7) ORDER BY month`).all();
 const projectProgress=db.prepare(`SELECT p.name,COUNT(t.id) total,SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) done FROM projects p LEFT JOIN tasks t ON t.project_id=p.id GROUP BY p.id ORDER BY total DESC LIMIT 10`).all();
 res.json({monthly,projectProgress});
});
module.exports=router;
