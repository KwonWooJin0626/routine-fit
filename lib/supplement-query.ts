import { iherbProductId } from "./supplement-label";

export function iherbEnglishName(name:string,url:string){
  const clean=name.replace(/^\s*#+\s*/,"").replace(/\s+/g," ").trim();
  if(!/[가-힣]/.test(clean)||!iherbProductId(url))return clean;
  const slug=new URL(url).pathname.split("/").filter(Boolean).at(-2)??"";
  if(!/^[a-z][a-z0-9-]+$/i.test(slug))return clean;
  // The English URL slug is a search name, not a fabricated translation/title.
  return slug.replaceAll("-"," ").replace(/\b[a-z]/g,c=>c.toUpperCase());
}

/** Search terms only: a result is a candidate for user selection, never a URL match. */
export function supplementNihQuery(name:string,url:string){
  let query=iherbEnglishName(name,url);
  if(iherbProductId(url)){
    const slug=new URL(url).pathname.split("/").filter(Boolean).at(-2)??"";
    if(/^[a-z][a-z0-9-]+$/i.test(slug)){
      query=slug.split(/-(?:with|from)-/i)[0]
        .replace(/-\d+-(?:(?:veggie|vegetarian|vegetable|vegan)-)?(?:softgels?|capsules?|tablets?|caplets?|packets?|scoops?|oz|ml|g)(?:-.*)?$/i,"")
        .replaceAll("-"," ");
    }
  }
  query=query.replace(/\s+\d+(?:\.\d+)?\s*(?:lbs?|oz|kg)\b.*$/i,"").replace(/[,\s]+$/,"");
  return query.length>100?query.slice(0,100).replace(/\s+\S*$/,""):query;
}
