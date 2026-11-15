const express=require('express');
const multer=require('multer');
const path=require('path');
const fs=require('fs');
const db=require('../database/db');
const {requireAuth}=require('../middleware/auth');
const router=express.Router();
const uploadDir=path.join(__dirname,'../public/uploads'); fs.mkdirSync(uploadDir,{recursive:true});
const upload=multer({dest:uploadDir,limits:{fileSize:5*1024*1024}});

function member(req,id){return db.prepare('SELECT p.*, pm.role member_role FROM projects p JOIN project_members pm ON pm.project_id=p.id WHERE p.id=? AND pm.user_id=?').get(id,req.session.user.id)}
function log(projectId,taskId,userId,action){db.prepare('INSERT INTO activity_logs(project_id,task_id,user_id,action) VALUES(?,?,?,?)').run(projectId,taskId||null,userId,action)}

router.get('/projects/:id',requireAuth,(req,res)=>{
 const project=member(req,req.params.id); if(!project)return res.status(404).send('Project not found');
 const tasks=db.prepare(`SELECT t.*,u.name assignee FROM tasks t LEFT JOIN users u ON u.id=t.assigned_to WHERE t.project_id=? ORDER BY t.created_at DESC`).all(project.id);
 const members=db.prepare(`SELECT u.id,u.name,u.email,pm.role FROM users u JOIN project_members pm ON pm.user_id=u.id WHERE pm.project_id=? ORDER BY u.name`).all(project.id);
 const activities=db.prepare(`SELECT a.*,u.name user_name,t.title task_title FROM activity_logs a JOIN users u ON u.id=a.user_id LEFT JOIN tasks t ON t.id=a.task_id WHERE a.project_id=? ORDER BY a.created_at DESC LIMIT 12`).all(project.id);
 const tags=db.prepare('SELECT DISTINCT name FROM task_tags WHERE task_id IN (SELECT id FROM tasks WHERE project_id=?) ORDER BY name').all(project.id);
 res.render('projects/kanban',{project,tasks,members,activities,tags});
});

router.get('/projects/:id/tasks/:taskId',requireAuth,(req,res)=>{
 const project=member(req,req.params.id); if(!project)return res.status(404).send('Project not found');
 const task=db.prepare(`SELECT t.*,u.name assignee,c.name creator FROM tasks t LEFT JOIN users u ON u.id=t.assigned_to LEFT JOIN users c ON c.id=t.created_by WHERE t.id=? AND t.project_id=?`).get(req.params.taskId,project.id);
 if(!task)return res.status(404).send('Task not found');
 const taskTags=db.prepare('SELECT * FROM task_tags WHERE task_id=? ORDER BY name').all(task.id);
 const attachments=db.prepare('SELECT a.*,u.name user_name FROM attachments a JOIN users u ON u.id=a.user_id WHERE a.task_id=? ORDER BY a.created_at DESC').all(task.id);
 const comments=db.prepare(`SELECT c.*,u.name user_name,u.email FROM comments c JOIN users u ON u.id=c.user_id WHERE c.task_id=? ORDER BY c.created_at ASC`).all(task.id);
 const activities=db.prepare(`SELECT a.*,u.name user_name FROM activity_logs a JOIN users u ON u.id=a.user_id WHERE a.task_id=? ORDER BY a.created_at DESC`).all(task.id);
 const members=db.prepare(`SELECT u.id,u.name FROM users u JOIN project_members pm ON pm.user_id=u.id WHERE pm.project_id=? ORDER BY u.name`).all(project.id);
 res.render('projects/task',{project,task,comments,activities,members,taskTags,attachments});
});

router.post('/projects/:id/tasks',requireAuth,(req,res)=>{
 const project=member(req,req.params.id);if(!project)return res.status(403).end();
 const {title,description,priority,assigned_to,due_date}=req.body;if(!title?.trim())return res.redirect('/projects/'+project.id);
 const r=db.prepare('INSERT INTO tasks(project_id,title,description,priority,assigned_to,due_date,created_by) VALUES(?,?,?,?,?,?,?)').run(project.id,title.trim(),description||'',priority||'medium',assigned_to||null,due_date||null,req.session.user.id);
 log(project.id,r.lastInsertRowid,req.session.user.id,'created a task');
 const tagNames=(req.body.tags||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).slice(0,8); tagNames.forEach(tag=>db.prepare('INSERT INTO task_tags(task_id,name) VALUES(?,?)').run(r.lastInsertRowid,tag));
 if(assigned_to&&Number(assigned_to)!==req.session.user.id) db.prepare('INSERT INTO notifications(user_id,project_id,task_id,message) VALUES(?,?,?,?)').run(assigned_to,project.id,r.lastInsertRowid,'You were assigned a new task: '+title.trim());
 req.app.get('io')?.to('project:'+project.id).emit('taskCreated');res.redirect('/projects/'+project.id);
});

router.post('/projects/:id/tasks/:taskId/comments',requireAuth,(req,res)=>{
 const project=member(req,req.params.id);if(!project)return res.status(403).end();
 const task=db.prepare('SELECT * FROM tasks WHERE id=? AND project_id=?').get(req.params.taskId,project.id);if(!task)return res.status(404).end();
 const comment=req.body.comment?.trim();if(comment){db.prepare('INSERT INTO comments(task_id,user_id,comment) VALUES(?,?,?)').run(task.id,req.session.user.id,comment);log(project.id,task.id,req.session.user.id,'added a comment');req.app.get('io')?.to('project:'+project.id).emit('commentAdded');}
 res.redirect('/projects/'+project.id+'/tasks/'+task.id);
});

router.post('/projects/:id/tasks/:taskId/update',requireAuth,(req,res)=>{
 const project=member(req,req.params.id);if(!project)return res.status(403).end();
 const task=db.prepare('SELECT * FROM tasks WHERE id=? AND project_id=?').get(req.params.taskId,project.id);if(!task)return res.status(404).end();
 const {title,description,priority,assigned_to,due_date}=req.body;
 db.prepare('UPDATE tasks SET title=?,description=?,priority=?,assigned_to=?,due_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(title.trim(),description||'',priority||'medium',assigned_to||null,due_date||null,task.id);
 log(project.id,task.id,req.session.user.id,'updated task details');
 res.redirect('/projects/'+project.id+'/tasks/'+task.id);
});

router.post('/projects/:id/members',requireAuth,(req,res)=>{
 const project=member(req,req.params.id);if(!project)return res.status(403).end();
 if(!['owner','admin','lead'].includes(project.member_role))return res.status(403).send('Only project leaders can manage members.');
 const user=db.prepare('SELECT id FROM users WHERE email=?').get(req.body.email?.trim().toLowerCase());
 if(user){db.prepare('INSERT OR IGNORE INTO project_members(project_id,user_id,role) VALUES(?,?,?)').run(project.id,user.id,'member');db.prepare('INSERT INTO notifications(user_id,project_id,message) VALUES(?,?,?)').run(user.id,project.id,'You were added to project: '+project.name);log(project.id,null,req.session.user.id,'added a team member');}
 res.redirect('/projects/'+project.id);
});

router.patch('/api/tasks/:id/status',requireAuth,(req,res)=>{
 const task=db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);if(!task||!member(req,task.project_id))return res.status(404).json({error:'Not found'});
 const allowed=['todo','in_progress','review','done'];if(!allowed.includes(req.body.status))return res.status(400).json({error:'Invalid status'});
 db.prepare('UPDATE tasks SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.body.status,task.id);log(task.project_id,task.id,req.session.user.id,'moved task to '+req.body.status);
 req.app.get('io')?.to('project:'+task.project_id).emit('taskUpdated',task.id,req.body.status);res.json({ok:true});
});

router.get('/api/notifications',requireAuth,(req,res)=>res.json(db.prepare(`SELECT n.*,p.name project_name,t.title task_title FROM notifications n LEFT JOIN projects p ON p.id=n.project_id LEFT JOIN tasks t ON t.id=n.task_id WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 20`).all(req.session.user.id)));
router.post('/api/notifications/read',requireAuth,(req,res)=>{db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.session.user.id);res.json({ok:true})});

router.post('/projects/:id/tasks/:taskId/tags',requireAuth,(req,res)=>{
 const project=member(req,req.params.id); if(!project)return res.status(403).end();
 const task=db.prepare('SELECT * FROM tasks WHERE id=? AND project_id=?').get(req.params.taskId,project.id); if(!task)return res.status(404).end();
 db.prepare('DELETE FROM task_tags WHERE task_id=?').run(task.id);
 (req.body.tags||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).slice(0,8).forEach(tag=>db.prepare('INSERT INTO task_tags(task_id,name) VALUES(?,?)').run(task.id,tag));
 log(project.id,task.id,req.session.user.id,'updated task tags'); res.redirect('/projects/'+project.id+'/tasks/'+task.id);
});

router.post('/projects/:id/tasks/:taskId/attachments',requireAuth,upload.single('file'),(req,res)=>{
 const project=member(req,req.params.id); if(!project)return res.status(403).end();
 const task=db.prepare('SELECT * FROM tasks WHERE id=? AND project_id=?').get(req.params.taskId,project.id); if(!task)return res.status(404).end();
 if(req.file){ db.prepare('INSERT INTO attachments(task_id,user_id,original_name,stored_name) VALUES(?,?,?,?)').run(task.id,req.session.user.id,req.file.originalname,req.file.filename); log(project.id,task.id,req.session.user.id,'uploaded an attachment'); }
 res.redirect('/projects/'+project.id+'/tasks/'+task.id);
});

router.get('/projects/:id/calendar',requireAuth,(req,res)=>{
 const project=member(req,req.params.id); if(!project)return res.status(404).send('Project not found');
 const tasks=db.prepare(`SELECT t.*,u.name assignee FROM tasks t LEFT JOIN users u ON u.id=t.assigned_to WHERE t.project_id=? AND t.due_date IS NOT NULL ORDER BY t.due_date`).all(project.id);
 res.render('projects/calendar',{project,tasks});
});

router.get('/projects/:id/search',requireAuth,(req,res)=>{
 const project=member(req,req.params.id); if(!project)return res.status(404).send('Project not found');
 const q=(req.query.q||'').trim(); const status=req.query.status||''; const priority=req.query.priority||'';
 let sql=`SELECT t.*,u.name assignee FROM tasks t LEFT JOIN users u ON u.id=t.assigned_to WHERE t.project_id=?`; const args=[project.id];
 if(q){sql+=' AND (t.title LIKE ? OR t.description LIKE ?)'; args.push('%'+q+'%','%'+q+'%');} if(status){sql+=' AND t.status=?';args.push(status);} if(priority){sql+=' AND t.priority=?';args.push(priority);} sql+=' ORDER BY t.updated_at DESC';
 const tasks=db.prepare(sql).all(...args); res.render('projects/search',{project,tasks,q,status,priority});
});

module.exports=router;
