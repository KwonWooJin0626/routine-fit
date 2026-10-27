import type { AppState } from "./model";
import { emptyBasicProfile } from "./basic-profile";

// Preserve exact historical responses. Only the new presentation summary is added.
export function withGrowthProfile(state:AppState):AppState{
  if(state.answers.basic)return state;
  const a=state.answers,exercise=a.exerciseDays*a.exerciseMinutes;
  return {...state,answers:{...a,basic:{...emptyBasicProfile(),origin:"legacy",nutritionAgeKnown:true,sleepRange:a.sleepHours<3?"under3":a.sleepHours<5?"3-5":a.sleepHours<7?"5-7":a.sleepHours<9?"7-9":"over9",exerciseRange:exercise===0?"none":exercise<60?"under60":exercise<120?"60-120":exercise<240?"120-240":"over240",sittingRange:a.sitting<4?"under4":a.sitting<6?"4-6":a.sitting<8?"6-8":"over8",supplementStatus:a.currentSupplements.trim()?"yes":"unknown"}}};
}
