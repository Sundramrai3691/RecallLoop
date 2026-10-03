import {describe,expect,it} from "vitest";
import {chunkText,stableChunkId} from "./chunker.js";

describe("grounding text chunks",()=>{
  it("chunks deterministically with ordered overlap and bounded size",()=>{
    const input=Array.from({length:80},(_,index)=>`Section ${index}: TCP congestion window and slow start details.`).join("\n");
    const first=chunkText("source-1","hash-1",input,300,40);
    const again=chunkText("source-1","hash-1",input,300,40);
    expect(first.length).toBeGreaterThan(1);
    expect(first.map((chunk)=>chunk.id)).toEqual(again.map((chunk)=>chunk.id));
    expect(first.every((chunk)=>chunk.text.length<=300)).toBe(true);
    expect(first.map((chunk)=>chunk.order)).toEqual(first.map((_,index)=>index));
  });
  it("uses stable IDs for the exact source version and chunk",()=>{
    expect(stableChunkId("s","h",0,"same")).toBe(stableChunkId("s","h",0,"same"));
    expect(stableChunkId("s","h",0,"same")).not.toBe(stableChunkId("s","h2",0,"same"));
  });
  it("handles blank input without creating an embedding",()=>expect(chunkText("s","h","  ")).toEqual([]));
});
