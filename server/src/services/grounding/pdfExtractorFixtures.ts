export function makePdf(pageTexts:string[]):Buffer {
  const objects:string[]=[];
  objects[1]="<< /Type /Catalog /Pages 2 0 R >>";
  const pageIds=pageTexts.map((_text,index)=>3+index*2);
  objects[2]=`<< /Type /Pages /Kids [${pageIds.map((id)=>`${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  pageTexts.forEach((text,index)=>{
    const pageId=pageIds[index]; const contentId=pageId+1;
    objects[pageId]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${pageIds.length*2+3} 0 R >> >> /Contents ${contentId} 0 R >>`;
    const escaped=text.replace(/([\\()])/g,"\\$1");
    const stream=text?`BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`:"";
    objects[contentId]=`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  });
  objects[pageIds.length*2+3]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  const chunks:Buffer[]=[Buffer.from("%PDF-1.7\n%----\n","ascii")];
  const offsets:number[]=[0]; let offset=chunks[0].length;
  for(let id=1;id<objects.length;id++){
    offsets[id]=offset; const object=Buffer.from(`${id} 0 obj\n${objects[id]}\nendobj\n`,"ascii"); chunks.push(object); offset+=object.length;
  }
  const xrefOffset=offset;
  let xref=`xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for(let id=1;id<objects.length;id++)xref+=`${String(offsets[id]).padStart(10,"0")} 00000 n \n`;
  xref+=`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref,"ascii"));
  return Buffer.concat(chunks);
}
