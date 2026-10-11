const http=require('node:http');
const {createHandler}=require('./handler.cjs');
const {createGoogleHandler}=require('../google/handler.cjs');
const {createRemovalHandler}=require('../submissions/remove.cjs');
const removal=createRemovalHandler();
const assistant=createHandler(),google=createGoogleHandler();
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost:3001');
 const handler=url.pathname==='/api/assistant'?assistant:url.pathname.startsWith('/api/google/')?google:url.pathname==='/api/submissions/remove'?removal:null;
 if(!handler){res.writeHead(404);res.end('Not found');return}
 req.query=Object.fromEntries(url.searchParams);if(handler===google)req.query.action=url.pathname.split('/').pop();
 let body='';
 try{
  for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>12000){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Request is too large.'}));return}}
  req.body=body?JSON.parse(body):{};
  res.status=code=>{res.statusCode=code;return res};
  res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res};
  res.redirect=(status,url)=>{res.writeHead(status,{Location:url});res.end()};
  await handler(req,res);
 }catch{if(!res.headersSent)res.writeHead(500);res.end()}
});
server.listen(3001,'127.0.0.1',()=>console.log('EIF API: http://127.0.0.1:3001'));
