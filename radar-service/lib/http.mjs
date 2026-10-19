export const ALLOWED_ORIGIN="https://digital-card-binder.github.io";
export function send(res,status,data) {
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin",ALLOWED_ORIGIN);
  res.setHeader("Vary","Origin");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Cache-Control",status===200?"public, max-age=30, stale-while-revalidate=30":"no-store");
  return res.status(status).json(data);
}
export function allowGet(req,res) {
  if(req.method==="OPTIONS"){
    res.setHeader("Access-Control-Allow-Origin",ALLOWED_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers","Content-Type");
    res.status(204).end();
    return false;
  }
  if(req.method!=="GET") {
    send(res,405,{error:"METHOD_NOT_ALLOWED"});
    return false;
  }
  return true;
}
