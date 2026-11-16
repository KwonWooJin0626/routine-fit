import { koreanDate, koreanTime } from "./sleep";

const windows = {
  lunch: { from: "10:00", until: "14:00", cutoff: "15:00" },
  dinner: { from: "17:00", until: "21:00", cutoff: "22:00" },
} as const;
export type MealWindow = keyof typeof windows;

export function mealReminderWindow(slot:MealWindow,now:Date){
  const date=koreanDate(now), time=koreanTime(now), window=windows[slot];
  if(time<window.until||time>=window.cutoff)return null;
  return {date,from:Date.parse(`${date}T${window.from}:00+09:00`),until:Date.parse(`${date}T${window.until}:00+09:00`)};
}

export function hasMealRecord(records:readonly {type:string;end:string;cancelled?:boolean}[],window:NonNullable<ReturnType<typeof mealReminderWindow>>){
  return records.some(record=>{
    if(record.type!=="meal"||record.cancelled)return false;
    const time=Date.parse(record.end);
    return window.from<=time&&time<=window.until;
  });
}
