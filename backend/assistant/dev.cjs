const http=require('node:http');
const {createHandler}=require('./handler.cjs');
const handler=createHandler();
const server=http.createServer(async(req,res)=>{
 if(req.url!=='/api/assistant'){res.writeHead(404);res.end('Not found');return;}
 let body='';
 try{
  for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>12000){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Request is too large.'}));return;}}
  req.body=body;
  res.status=code=>{res.statusCode=code;return res};
  res.json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return res};
  await handler(req,res);
 }catch{if(!res.headersSent)res.writeHead(500);res.end();}
});
server.listen(3001,'127.0.0.1',()=>console.log('EIF assistant API: http://127.0.0.1:3001/api/assistant'));
