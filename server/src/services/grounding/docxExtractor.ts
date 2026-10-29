import mammoth from "mammoth";
import { parseDocument } from "htmlparser2";
import type { ChildNode, Element } from "domhandler";
import { AppError } from "../../utils/errors.js";

export const MAX_DOCX_BYTES = 10 * 1024 * 1024;
export const MAX_DOCX_EXPANDED_BYTES = 20 * 1024 * 1024;
export const MAX_DOCX_ENTRIES = 2_000;
export const MAX_DOCX_TEXT_CHARS = 250_000;
const MIN_MEANINGFUL_CHARACTERS = 20;
const EOCD = 0x06054b50;
const CENTRAL_HEADER = 0x02014b50;

export interface DocxSegment { start:number; end:number; section:string|null; paragraph:number; }
export interface ExtractedDocx { text:string; paragraphCount:number; sections:string[]; segments:DocxSegment[]; }

function docxError(message:string,code:string,status=422){return new AppError(message,status,code);}

/** Read ZIP central-directory sizes before JSZip/Mammoth expands any XML parts. */
export function validateDocxContainer(buffer:Buffer):void {
  if(!Buffer.isBuffer(buffer))throw docxError("Upload a DOCX file.","DOCX_FILE_REQUIRED",400);
  if(buffer.length>MAX_DOCX_BYTES)throw docxError("This DOCX is larger than the 10 MB upload limit.","DOCX_TOO_LARGE",413);
  if(buffer.length<22||buffer.readUInt32LE(0)!==0x04034b50)throw docxError("The uploaded file is not a valid DOCX document.","DOCX_INVALID_CONTENT");
  const min=Math.max(0,buffer.length-22-0xffff);let eocd=-1;
  for(let pos=buffer.length-22;pos>=min;pos--){if(buffer.readUInt32LE(pos)===EOCD&&pos+22+buffer.readUInt16LE(pos+20)===buffer.length){eocd=pos;break;}}
  if(eocd<0)throw docxError("The DOCX ZIP container is malformed or truncated.","DOCX_ZIP_INVALID");
  const disk=buffer.readUInt16LE(eocd+4),directoryDisk=buffer.readUInt16LE(eocd+6),diskEntries=buffer.readUInt16LE(eocd+8),entries=buffer.readUInt16LE(eocd+10),directorySize=buffer.readUInt32LE(eocd+12),directoryOffset=buffer.readUInt32LE(eocd+16);
  if(disk!==0||directoryDisk!==0||diskEntries!==entries||entries===0xffff||directorySize===0xffffffff||directoryOffset===0xffffffff)
    throw docxError("This encrypted, multi-volume, or ZIP64 DOCX variant is not supported.","DOCX_VARIANT_UNSUPPORTED");
  if(entries>MAX_DOCX_ENTRIES||directoryOffset+directorySize>eocd||directoryOffset+directorySize>buffer.length)
    throw docxError("This DOCX archive exceeds the safe document-part limit.","DOCX_ARCHIVE_LIMIT",413);
  let cursor=directoryOffset,totalExpanded=0;const names=new Set<string>();
  for(let index=0;index<entries;index++){
    if(cursor+46>directoryOffset+directorySize||buffer.readUInt32LE(cursor)!==CENTRAL_HEADER)throw docxError("The DOCX ZIP directory is malformed or truncated.","DOCX_ZIP_INVALID");
    const flags=buffer.readUInt16LE(cursor+8),method=buffer.readUInt16LE(cursor+10),compressed=buffer.readUInt32LE(cursor+20),expanded=buffer.readUInt32LE(cursor+24),nameLength=buffer.readUInt16LE(cursor+28),extraLength=buffer.readUInt16LE(cursor+30),commentLength=buffer.readUInt16LE(cursor+32),localOffset=buffer.readUInt32LE(cursor+42);
    if(flags&1)throw docxError("Encrypted DOCX files are not supported. Remove the password and try again.","DOCX_ENCRYPTED");
    if(compressed===0xffffffff||expanded===0xffffffff||localOffset===0xffffffff)throw docxError("ZIP64 DOCX files are not supported.","DOCX_VARIANT_UNSUPPORTED");
    if(nameLength===0||cursor+46+nameLength+extraLength+commentLength>directoryOffset+directorySize||localOffset+30>directoryOffset)throw docxError("The DOCX ZIP directory is malformed or truncated.","DOCX_ZIP_INVALID");
    const name=buffer.subarray(cursor+46,cursor+46+nameLength).toString(flags&0x800?"utf8":"latin1");
    if(name.startsWith("/")||name.split(/[\\/]/).includes(".."))throw docxError("The DOCX contains an unsafe archive path.","DOCX_ZIP_INVALID");
    if(method!==0&&method!==8)throw docxError("This DOCX uses an unsupported ZIP compression method.","DOCX_COMPRESSION_UNSUPPORTED");
    if(buffer.readUInt32LE(localOffset)!==0x04034b50)throw docxError("A DOCX archive part is malformed or truncated.","DOCX_ZIP_INVALID");
    const localFlags=buffer.readUInt16LE(localOffset+6),localMethod=buffer.readUInt16LE(localOffset+8),localNameLength=buffer.readUInt16LE(localOffset+26),localExtraLength=buffer.readUInt16LE(localOffset+28),dataStart=localOffset+30+localNameLength+localExtraLength;
    const localName=buffer.subarray(localOffset+30,localOffset+30+localNameLength).toString(flags&0x800?"utf8":"latin1");
    if((localFlags&1)||localFlags!==flags||localMethod!==method||localName!==name||dataStart+compressed>directoryOffset)throw docxError("A DOCX archive part has inconsistent or truncated ZIP headers.","DOCX_ZIP_INVALID");
    if(names.has(name))throw docxError("The DOCX contains duplicate archive parts.","DOCX_ZIP_INVALID");names.add(name);
    if(expanded>MAX_DOCX_EXPANDED_BYTES||compressed===0&&expanded>0)throw docxError("A DOCX part exceeds the safe expanded-size limit.","DOCX_EXPANDED_TOO_LARGE",413);
    if(compressed>0&&expanded/compressed>1000)throw docxError("A DOCX part has an unsafe compression ratio.","DOCX_EXPANSION_RATIO",413);
    totalExpanded+=expanded;if(totalExpanded>MAX_DOCX_EXPANDED_BYTES)throw docxError("The DOCX expands beyond the 20 MB processing limit.","DOCX_EXPANDED_TOO_LARGE",413);
    cursor+=46+nameLength+extraLength+commentLength;
  }
  if(cursor!==directoryOffset+directorySize)throw docxError("The DOCX ZIP directory has inconsistent lengths.","DOCX_ZIP_INVALID");
  if(!names.has("[Content_Types].xml")||!names.has("_rels/.rels")||!names.has("word/document.xml"))throw docxError("This ZIP does not contain the required DOCX document parts.","DOCX_PARTS_MISSING");
}

function element(node:ChildNode):node is Element{return node.type==="tag"||node.type==="script"||node.type==="style";}
function nodeText(node:ChildNode):string {
  if(node.type==="text")return node.data;
  if(!element(node))return "";
  if(node.name==="br")return " ";
  return node.children.map(nodeText).join("");
}

function normalizeInline(value:string):string{return value.replace(/\u0000/g,"").replace(/[\t\f\v ]+/g," ").replace(/\s+([,.;:!?])/g,"$1").trim();}

export async function extractDocx(buffer:Buffer):Promise<ExtractedDocx>{
  validateDocxContainer(buffer);
  try{
    const converted=await mammoth.convertToHtml({buffer},{styleMap:["p[style-name='Code'] => pre:separator('\\n')","p[style-name='Source Code'] => pre:separator('\\n')"],externalFileAccess:false,includeEmbeddedStyleMap:false});
    const root=parseDocument(converted.value,{decodeEntities:true});
    const lines:string[]=[];const segments:DocxSegment[]=[];const headings:string[]=[];const allSections=new Set<string>();let paragraph=0;let textOffset=0;
    function emit(text:string,kind:"paragraph"|"heading"|"list"|"table"|"code"){const clean=kind==="code"?text.replace(/\r\n?/g,"\n").replace(/\u0000/g,"").trim():normalizeInline(text);if(!clean)return;paragraph++;const section=headings.length?headings.join(" > "):null;const lead=kind==="heading"?"":kind==="list"?"- ":kind==="code"?"Code:\n":kind==="table"?"Table row: ":"";const line=`${lead}${clean}`;let headingSection:string|null=null;if(kind==="heading"){headings.push(clean);headingSection=headings.join(" > ");allSections.add(headingSection);}if(lines.length){lines.push("");textOffset++;}const start=textOffset;lines.push(line);textOffset+=line.length;segments.push({start,end:textOffset,section:kind==="heading"?headingSection:section,paragraph});}
    function visit(node:ChildNode,inTable=false,inList=false){if(!element(node)){return;}const name=node.name;
      if(/^h[1-6]$/.test(name)){const depth=Number(name.slice(1));headings.length=Math.min(headings.length,depth-1);emit(node.children.map(nodeText).join(""),"heading");return;}
      if(name==="p"){const text=node.children.map(nodeText).join("");if(text.trim())emit(text,inTable?"table":inList?"list":"paragraph");return;}
      if(name==="pre"){const text=node.children.map(nodeText).join("\n");if(text.trim())emit(text,"code");return;}
      if(name==="li"){const text=node.children.map(nodeText).join(" ");if(text.trim())emit(text,"list");return;}
      if(name==="tr"){const cells=node.children.filter(element).filter((cell)=>cell.name==="td"||cell.name==="th").map((cell)=>normalizeInline(cell.children.map(nodeText).join(" "))).filter(Boolean);if(cells.length)emit(cells.join(" | "),"table");return;}
      if(name==="table"){for(const child of node.children)visit(child,true,inList);return;}
      if(name==="ul"||name==="ol"){for(const child of node.children)visit(child,inTable,true);return;}
      for(const child of node.children)visit(child,inTable,inList);
    }
    for(const child of root.children)visit(child);
    const text=lines.join("\n").trim();
    if(text.length>MAX_DOCX_TEXT_CHARS)throw docxError("This DOCX contains more than the 250,000-character text limit.","DOCX_TEXT_TOO_LARGE",413);
    const useful=text.match(/[\p{L}\p{N}]/gu)?.length??0;if(useful<MIN_MEANINGFUL_CHARACTERS)throw docxError("No useful text could be extracted from this DOCX.","DOCX_EMPTY");
    const normalizedOffset=text.length<lines.join("\n").length?lines.join("\n").length-text.length:0;
    return{text,paragraphCount:paragraph,sections:[...allSections],segments:segments.map((segment)=>({...segment,start:Math.max(0,segment.start-normalizedOffset),end:Math.max(0,segment.end-normalizedOffset)})).filter((segment)=>segment.end>segment.start)};
  }catch(error){if(error instanceof AppError)throw error;throw docxError("This DOCX is malformed or could not be read. Check the document and try again.","DOCX_PARSE_FAILED");}
}
