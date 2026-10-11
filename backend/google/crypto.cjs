const crypto=require('node:crypto');
function keyBytes(key){const value=Buffer.from(key||'','base64');if(value.length!==32)throw new Error('Google token encryption key must be 32 bytes');return value}
function encrypt(value,key){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',keyBytes(key),iv);const content=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),content].map(v=>v.toString('base64url')).join('.')}
function decrypt(value,key){const [iv,tag,content]=value.split('.').map(v=>Buffer.from(v,'base64url'));const cipher=crypto.createDecipheriv('aes-256-gcm',keyBytes(key),iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(content),cipher.final()]).toString('utf8')}
module.exports={encrypt,decrypt,keyBytes};
