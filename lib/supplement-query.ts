import { iherbProductId } from "./supplement-label";

/** Search terms only: a result is a candidate for user selection, never a URL match. */
export function supplementNihQuery(name:string,url:string){
  let query=name.trim();
  if(iherbProductId(url)){
    const slug=new URL(url).pathname.split("/").filter(Boolean).at(-2)??"";
    if(/^[a-z][a-z0-9-]+$/i.test(slug)){
      query=slug.split(/-(?:with|from)-/i)[0]
        .replace(/-\d+-(?:(?:veggie|vegetarian|vegetable|vegan)-)?(?:softgels?|capsules?|tablets?|caplets?|packets?|scoops?|oz|ml|g)(?:-.*)?$/i,"")
        .replaceAll("-"," ");
    }
  }
  return query.length>100?query.slice(0,100).replace(/\s+\S*$/,""):query;
}
