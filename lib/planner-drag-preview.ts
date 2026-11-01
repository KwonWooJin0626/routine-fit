// Only the drag image changes. The template's scheduled duration is untouched.
export function createPlannerDragPreview(card:HTMLElement,title:string){
  const cell=card.closest(".sp-layout")?.querySelector<HTMLElement>(".sp-slot");
  const rect=cell?.getBoundingClientRect(),style=getComputedStyle(card);
  const preview=document.createElement("div");
  preview.className="sp-drag-preview";preview.textContent=title;preview.setAttribute("aria-hidden","true");
  Object.assign(preview.style,{width:`${rect?.width||96}px`,height:`${rect?.height||24}px`,backgroundColor:style.backgroundColor,color:style.color,borderColor:style.borderColor});
  document.body.appendChild(preview);return preview;
}
