import { describe,expect,it } from "vitest";
import JSZip from "jszip";
import { extractDocx,MAX_DOCX_BYTES,MAX_DOCX_EXPANDED_BYTES,validateDocxContainer } from "./docxExtractor.js";

async function docx(documentXml:string){
  const zip=new JSZip();
  zip.file("[Content_Types].xml",`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels",`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels",`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`);
  zip.file("word/document.xml",documentXml);
  zip.file("word/styles.xml",`<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/></w:style></w:styles>`);
  zip.file("word/numbering.xml",`<?xml version="1.0"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="720"/></w:tabs><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`);
  return zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"});
}
const body=(children:string)=>`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${children}<w:sectPr/></w:body></w:document>`;
const p=(text:string,style="")=>`<w:p>${style?`<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`:""}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

describe("DOCX extraction",()=>{
  it("preserves heading, list, table, code, unicode and paragraph/section locations",async()=>{
    const xml=body(p("Database Indexes","Heading1")+p("Composite B-tree indexes follow leftmost-prefix behavior for queries. Unicode naïve café λ.")+`<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Prefix columns guide index scans</w:t></w:r></w:p>`+`<w:tbl><w:tr><w:tc>${p("SQL")}</w:tc><w:tc>${p("CREATE INDEX idx_orders_tenant ON orders (tenant_id, created_at);")}</w:tc></w:tr></w:tbl>`+p("SELECT tenant_id FROM orders;","Code"));
    const result=await extractDocx(await docx(xml));
    expect(result.text).toContain("Database Indexes");expect(result.text).toContain("- Prefix columns guide index scans");expect(result.text).toContain("SQL | CREATE INDEX idx_orders_tenant ON orders (tenant_id, created_at);");expect(result.text).toContain("SELECT tenant_id FROM orders;");
    expect(result.text).toContain("Unicode naïve café λ");expect(result.text).not.toContain("\uFFFD");expect(result.paragraphCount).toBeGreaterThanOrEqual(5);expect(result.sections).toContain("Database Indexes");
    expect(result.segments.some((segment)=>segment.section==="Database Indexes"&&segment.paragraph>=2)).toBe(true);
  });

  it("rejects extension-only data, truncated archives, and missing required parts",async()=>{
    expect(()=>validateDocxContainer(Buffer.from("not a word file"))).toThrowError(expect.objectContaining({code:"DOCX_INVALID_CONTENT"}));
    const valid=await docx(body(p("A sufficiently long paragraph makes this document useful.")));
    expect(()=>validateDocxContainer(valid.subarray(0,valid.length-10))).toThrowError(expect.objectContaining({code:"DOCX_ZIP_INVALID"}));
    const missing=new JSZip();missing.file("[Content_Types].xml","<Types/>");
    const missingBuffer=await missing.generateAsync({type:"nodebuffer"});
    expect(()=>validateDocxContainer(missingBuffer)).toThrowError(expect.objectContaining({code:"DOCX_PARTS_MISSING"}));
  });

  it("rejects empty documents, unsafe expanded sizes and oversized uploads",async()=>{
    const empty=await docx(body(""));await expect(extractDocx(empty)).rejects.toMatchObject({code:"DOCX_EMPTY"});
    const malformed=await docx(body(p("A sufficiently long paragraph makes a valid DOCX fixture.")));
    const central=malformed.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
    malformed.writeUInt32LE(MAX_DOCX_EXPANDED_BYTES+1,central+24);
    expect(()=>validateDocxContainer(malformed)).toThrowError(expect.objectContaining({code:"DOCX_EXPANDED_TOO_LARGE"}));
    const oversized=Buffer.alloc(MAX_DOCX_BYTES+1);await expect(extractDocx(oversized)).rejects.toMatchObject({code:"DOCX_TOO_LARGE",status:413});
  });

  it("rejects encrypted DOCX ZIP entries",async()=>{
    const buffer=await docx(body(p("A paragraph long enough to make a useful test document.")));
    const central=buffer.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));buffer.writeUInt16LE(buffer.readUInt16LE(central+8)|1,central+8);
    await expect(extractDocx(buffer)).rejects.toMatchObject({code:"DOCX_ENCRYPTED"});
  });
});
