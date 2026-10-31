import { activityPreferencesSchema, type ActivityDomain, type ActivityPreferences, type ActivityProfile } from "./activity-profile";

/** Commit only the category the user has just confirmed; no partial next category. */
export function checkpointActivity(previous:ActivityPreferences|undefined,profile:ActivityProfile,selection:ActivityDomain[],route:"routine"|"schedule"):ActivityPreferences{
  const index=selection.indexOf(profile.domain);
  if(index<0)throw new Error("선택한 분야를 확인해주세요.");
  const profiles=[...(previous?.profiles??[]).filter(p=>p.domain!==profile.domain).map(p=>({...p,enabled:selection.includes(p.domain)})),{...profile,enabled:true,updatedAt:new Date().toISOString()}];
  return activityPreferencesSchema.parse({version:1,route,profiles,selectedDomains:selection,pendingDomains:selection.slice(index+1)});
}
