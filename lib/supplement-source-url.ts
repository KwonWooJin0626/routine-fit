// Exact hosts only: page fetching never accepts arbitrary user-controlled servers.
const hosts=new Set(["iherb.com","www.iherb.com","kr.iherb.com","lifeextension.com","www.lifeextension.com","nowfoods.com","www.nowfoods.com","solgar.com","www.solgar.com","thorne.com","www.thorne.com","naturemade.com","www.naturemade.com"]);
export function supplementSourceUrl(value:string){
  try{const u=new URL(value);if(u.protocol!=="https:"||u.username||u.password||u.port||!hosts.has(u.hostname)||u.pathname==="/")return null;u.hash="";return u.href;}catch{return null;}
}
