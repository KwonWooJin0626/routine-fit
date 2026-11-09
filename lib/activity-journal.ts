import type { AppState } from "./model";
import { type PetDocument,type PetRequest } from "./pet-model";
import { newPetDocument } from "./pet-engine";
import { applyPetCommand } from "./pet-actions";
import type { SleepRecord } from "./sleep";

export { activityJournalSchema,type ActivityJournal,type ActivityExecution } from "./activity-journal-model";
import { activityJournalSchema,type ActivityJournal } from "./activity-journal-model";
export function humanDocument(app:AppState|null,legacy?:PetDocument|null):PetDocument{
  const doc=newPetDocument("나의 활동","activity-journal",new Date(Date.now()-90*86400000));
  // Canonical entries win over legacy copies, including cancellations.
  doc.records=[...new Map([...(legacy?.records??[]),...(app?.activityJournal?.records??[])].map(r=>[r.id,r])).values()];
  doc.receipts=app?.activityJournal?.receipts??legacy?.receipts??[];
  return doc;
}
export const isActivityCommand=(request:PetRequest)=>["record","edit","cancel","feeling"].includes(request.command.action);
export function applyJournalCommand(old:PetDocument|null,app:AppState,input:PetRequest,now=new Date(),sleep:SleepRecord[]=[]){
  const human=humanDocument(app,old);
  if(isActivityCommand(input)){
    // The game compactor must not drop human records. An early seed keeps all existing facts;
    // the command validator still enforces a 90-day correction window below.
    const cutoff=new Date(now.getTime()-90*86400000).toISOString();
    human.seed.at=cutoff;human.seed.lastEvidenceAt=cutoff;
    const preserved=human.records.filter(r=>r.end<=cutoff);
    const result=applyPetCommand(human,app,input,now,sleep);
    const records=[...new Map([...preserved,...result.document.records].map(r=>[r.id,r])).values()];
    const journal:ActivityJournal={records,receipts:result.document.receipts};
    activityJournalSchema.parse(journal);
    const document=old?{...old,records:records.filter(r=>r.end>=old.seed.at),receipts:result.document.receipts}:null;
    return {document,app:{...result.app,activityJournal:journal},reactionId:document?result.reactionId:undefined};
  }
  const result=applyPetCommand(old,app,input,now,sleep);
  // Adoption/reset changes the game only. Pre-adoption human records earn no retroactive XP.
  const receipts=[...new Map([...human.receipts,...result.document.receipts].map(r=>[r.key,r])).values()].slice(-100);
  return {...result,document:{...result.document,receipts},app:{...result.app,activityJournal:{records:human.records,receipts}}};
}
