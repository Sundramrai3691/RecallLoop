import {createHash} from "node:crypto";
import {beforeEach,describe,expect,it,vi} from "vitest";

const queryMock=vi.hoisted(()=>vi.fn());
vi.mock("../../db/postgres.js",()=>({query:queryMock,withTransaction:vi.fn()}));
vi.mock("./embeddingProvider.js",async(importOriginal)=>{
  const actual=await importOriginal<typeof import("./embeddingProvider.js")>();
  return {...actual,createEmbeddingProvider:()=>new actual.DeterministicEmbeddingProvider()};
});

import {retrieveChunks} from "../../repositories/groundingRepository.js";
import {rankRetrievedChunks,retrieveForGap} from "./groundedRemediationService.js";
import {DeterministicEmbeddingProvider} from "./embeddingProvider.js";

interface FixtureChunk {
  userId:string;
  status:string;
  model:string;
  createdAt:number;
  chunkOrder:number;
  chunkId:string;
  sourceId:string;
  title:string;
  sourceType:string;
  reference:string;
  provenance:Record<string,unknown>;
  pageNumber:string|null;
  section:string|null;
  paragraphStart:string|null;
  paragraphEnd:string|null;
  text:string;
  embedding:number[];
}

let fixture:FixtureChunk[]=[];
let lastQuery={sql:"",values:[] as unknown[]};
let lastSelectedRows:FixtureChunk[]=[];
let lastCandidateSelectionMs=0;

beforeEach(()=>{
  fixture=[];
  lastQuery={sql:"",values:[]};
  lastSelectedRows=[];
  lastCandidateSelectionMs=0;
  queryMock.mockImplementation(async(sql:string,values:unknown[])=>{
    lastQuery={sql,values};
    const sourceRestricted=sql.includes("AND s.id=$4::uuid");
    const [userId,model,dimensions]=values as [string,string,number];
    const sourceId=sourceRestricted?values[3] as string:null;
    const lexicalQuery=values[sourceRestricted?4:3] as string;
    const candidateLimit=values[sourceRestricted?5:4] as number;
    const selectionStarted=performance.now();
    const terms=lexicalQuery.split(" | ");
    const rows=fixture.filter((row)=>row.userId===userId&&row.status==="processed"&&row.model===model&&row.embedding.length===dimensions&&(!sourceId||row.sourceId===sourceId))
      .map((row)=>({...row,lexicalRank:terms.filter((term)=>new RegExp(`\\b${term}\\b`,"i").test(row.text)).length}))
      .filter((row)=>row.lexicalRank>0)
      .sort((a,b)=>b.lexicalRank-a.lexicalRank||a.chunkId.localeCompare(b.chunkId)).slice(0,candidateLimit)
      .map(({lexicalRank,...row})=>row);
    lastCandidateSelectionMs=performance.now()-selectionStarted;
    lastSelectedRows=rows;
    return{rows:rows.map((row)=>({...row,embeddingModel:row.model,embeddingDimensions:row.embedding.length})),rowCount:rows.length};
  });
});

function fixtureChunk(input:Partial<FixtureChunk>&Pick<FixtureChunk,"chunkId"|"sourceId"|"text"|"embedding">):FixtureChunk {
  return{
    userId:"learner",status:"processed",model:"hash-token-v1",createdAt:0,chunkOrder:0,title:"Source",sourceType:"text",reference:"",provenance:{},
    pageNumber:null,section:null,paragraphStart:null,paragraphEnd:null,...input,
  };
}

describe("grounded remediation retrieval",()=>{
  it("ranks an older relevant passage beyond the old 40-row window and preserves its citation",async()=>{
    const provider=new DeterministicEmbeddingProvider();
    const distractors=Array.from({length:5005},(_,index)=>({
      text:`Unrelated field guide record number ${index} covers aquatic habitats and seasonal rainfall.`,
      sourceId:`new-source-${index}`,
    }));
    const targetIndex=4999;
    const chunkIds=Array.from({length:distractors.length},(_,index)=>createHash("sha256").update(`retrieval-fixture-${index}`).digest("hex")).sort();
    distractors[targetIndex]={text:"TCP congestion control uses slow start to increase the congestion window (cwnd) as acknowledgements arrive.",sourceId:"old-source"};
    const vectors=await provider.embed(distractors.map((item)=>item.text));
    fixture=distractors.map((item,index)=>fixtureChunk({
      chunkId:chunkIds[index],
      sourceId:item.sourceId,
      title:item.sourceId==="old-source"?"Older TCP notes":"Recent unrelated notes",
      createdAt:item.sourceId==="old-source"?1:2_000_000+index,
      chunkOrder:item.sourceId==="old-source"?62:0,
      text:item.text,
      embedding:vectors[index],
      pageNumber:item.sourceId==="old-source"?"12":null,
      section:item.sourceId==="old-source"?"Congestion control":null,
    }));
    const started=performance.now();
    const retrieved=await retrieveForGap({userId:"learner",conceptName:"TCP",knowledgePoint:"slow start congestion window"});
    const elapsed=performance.now()-started;

    expect(lastQuery.sql).toContain("s.user_id=$1");
    expect(lastQuery.sql).toContain("s.processing_status='processed'");
    expect(lastQuery.sql).toContain("c.embedding_model=$2 AND c.embedding_dimensions=$3");
    expect(lastQuery.sql).toContain("to_tsvector('simple'::regconfig,c.content) @@ to_tsquery('simple'::regconfig,$4)");
    expect(lastQuery.sql).toContain("ORDER BY ts_rank_cd");
    expect(lastQuery.sql).toContain("c.id ASC");
    expect(lastQuery.sql).not.toContain("s.created_at DESC");
    expect(lastQuery.sql).not.toContain("c.chunk_order LIMIT");
    expect(lastQuery.values).toEqual(["learner","hash-token-v1",64,"tcp | slow | start | congestion | window",5000]);
    expect(retrieved[0]).toMatchObject({
      chunkId:chunkIds[targetIndex],
      sourceId:"old-source",
      pageNumber:12,
      section:"Congestion control",
    });
    expect(retrieved).toHaveLength(1);
    expect(retrieved.reduce((size,chunk)=>size+chunk.text.length,0)).toBeLessThanOrEqual(5*1200);
    expect(elapsed).toBeGreaterThan(0);
    if(process.env.RECALLLOOP_RETRIEVAL_BENCHMARK==="1"){
      const legacyPipelineStarted=performance.now();
      const legacySelectionStarted=performance.now();
      const legacyCandidates=fixture.filter((row)=>row.userId==="learner"&&row.status==="processed"&&row.model==="hash-token-v1"&&row.embedding.length===64)
        .sort((a,b)=>b.createdAt-a.createdAt||a.chunkOrder-b.chunkOrder).slice(0,40);
      const legacySelectionMs=performance.now()-legacySelectionStarted;
      const queryText="TCP. slow start congestion window";
      const [queryEmbedding]=await provider.embed([queryText]);
      const legacyRankingStarted=performance.now();
      const legacyResults=rankRetrievedChunks(queryText,queryEmbedding,legacyCandidates);
      const legacyRankingMs=performance.now()-legacyRankingStarted;
      const legacyTotalRetrievalMs=performance.now()-legacyPipelineStarted;
      const rankingStarted=performance.now();
      const currentResults=rankRetrievedChunks(queryText,queryEmbedding,lastSelectedRows);
      const rankingMs=performance.now()-rankingStarted;
      console.info("retrieval-fixture-benchmark",JSON.stringify({
        fixtureRows:fixture.length,
        before:{candidateSelectionMs:Number(legacySelectionMs.toFixed(3)),rankedChunks:legacyCandidates.length,rankingMs:Number(legacyRankingMs.toFixed(3)),totalRetrievalMs:Number(legacyTotalRetrievalMs.toFixed(3)),contextCharacters:legacyResults.reduce((total,row)=>total+row.text.length,0)},
        after:{candidateSelectionMs:Number(lastCandidateSelectionMs.toFixed(3)),rankedChunks:lastSelectedRows.length,rankingMs:Number(rankingMs.toFixed(3)),totalRetrievalMs:Number(elapsed.toFixed(3)),contextCharacters:currentResults.reduce((total,row)=>total+row.text.length,0)},
        databaseQueryExecuted:false,
        memoryMeasured:false,
      }));
    }
  });

  it("finds a relevant passage beyond the old stable-ID 5,000-row cap",async()=>{
    const provider=new DeterministicEmbeddingProvider();
    const irrelevantText="A field guide about aquatic habitats, seasonal rainfall, and plant biodiversity.";
    const relevantText="TCP congestion control uses slow start to increase the congestion window as acknowledgements arrive.";
    const [irrelevantEmbedding,relevantEmbedding]=await provider.embed([irrelevantText,relevantText]);
    fixture=Array.from({length:5005},(_,index)=>fixtureChunk({
      chunkId:`${String(index).padStart(5,"0")}-unrelated`,
      sourceId:`source-${index}`,
      text:irrelevantText,
      embedding:irrelevantEmbedding,
    }));
    fixture.push(fixtureChunk({chunkId:"zzzzz-relevant",sourceId:"old-source",text:relevantText,embedding:relevantEmbedding,createdAt:1,chunkOrder:250}));

    const retrieved=await retrieveForGap({userId:"learner",conceptName:"TCP",knowledgePoint:"slow start congestion window"});

    expect(fixture.map((item)=>item.chunkId).sort().slice(0,5000)).not.toContain("zzzzz-relevant");
    expect(retrieved.map((chunk)=>chunk.chunkId)).toContain("zzzzz-relevant");
    expect(retrieved[0].sourceId).toBe("old-source");
    expect(lastSelectedRows).toHaveLength(1);
    expect(lastQuery.values[3]).toContain("tcp");
  });

  it("applies ownership, processing, model, dimension, and source filters at the repository boundary",async()=>{
    const vector=[1,0];
    fixture=[
      fixtureChunk({chunkId:"eligible",sourceId:"selected",text:"eligible",embedding:vector}),
      fixtureChunk({chunkId:"foreign",sourceId:"selected",text:"foreign",embedding:vector,userId:"other"}),
      fixtureChunk({chunkId:"failed",sourceId:"selected",text:"failed",embedding:vector,status:"failed"}),
      fixtureChunk({chunkId:"wrong-model",sourceId:"selected",text:"wrong model",embedding:vector,model:"other"}),
      fixtureChunk({chunkId:"wrong-dimension",sourceId:"selected",text:"wrong dimension",embedding:[1]}),
      fixtureChunk({chunkId:"other-source",sourceId:"another",text:"other source",embedding:vector}),
    ];

    const chunks=await retrieveChunks("learner",vector,"hash-token-v1","eligible",5000,"selected");

    expect(chunks.map((chunk)=>chunk.chunkId)).toEqual(["eligible"]);
    expect(lastQuery.values).toEqual(["learner","hash-token-v1",2,"selected","eligible",5000]);
    expect(lastQuery.sql).toContain("s.id=$4::uuid");
  });

  it("does not query PostgreSQL when the target yields no searchable terms",async()=>{
    const chunks=await retrieveChunks("learner",[1,0],"hash-token-v1","the and of",5);
    expect(chunks).toEqual([]);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("uses relevant content from an early long-document chunk and retains its page citation",async()=>{
    const provider=new DeterministicEmbeddingProvider();
    const texts=Array.from({length:120},(_,index)=>index===3
      ?"TCP congestion control slow start grows the congestion window when acknowledgements arrive."
      :`Chapter appendix ${index} explains unrelated plant growth, rainfall, and ocean temperature.`);
    const vectors=await provider.embed(texts);
    fixture=texts.map((text,index)=>fixtureChunk({
      chunkId:`long-${String(index).padStart(3,"0")}`,
      sourceId:"long-document",
      chunkOrder:index,
      text,
      embedding:vectors[index],
      pageNumber:String(index+1),
    }));

    const retrieved=await retrieveForGap({userId:"learner",conceptName:"TCP",knowledgePoint:"slow start congestion window",sourceId:"long-document"});

    expect(retrieved[0]).toMatchObject({chunkId:"long-003",pageNumber:4});
    expect(lastQuery.values[3]).toBe("long-document");
  });
});

describe("retrieval relevance selection",()=>{
  it("deduplicates near-identical passages while retaining separate relevant evidence",async()=>{
    const provider=new DeterministicEmbeddingProvider();
    const query="TCP congestion window slow start acknowledgements";
    const [queryEmbedding]=await provider.embed([query]);
    const texts=[
      "TCP congestion control uses slow start to increase the congestion window as acknowledgements arrive.",
      "TCP congestion control uses slow start to increase the congestion window as acknowledgements arrive.",
      "A congestion window limits bytes sent before TCP acknowledgements are received.",
    ];
    const embeddings=await provider.embed(texts);
    const results=rankRetrievedChunks(query,queryEmbedding,texts.map((text,index)=>({
      sourceId:`source-${index}`,chunkId:`chunk-${index}`,title:"TCP",reference:"",sourceType:"text",relevance:0,text,embedding:embeddings[index],
    })));

    expect(results.map((result)=>result.chunkId)).toEqual(["chunk-0","chunk-2"]);
  });

  it("returns no candidate below the relevance threshold",async()=>{
    const provider=new DeterministicEmbeddingProvider();
    const query="TCP congestion window slow start";
    const [queryEmbedding]=await provider.embed([query]);
    const [irrelevantEmbedding]=await provider.embed(["Photosynthesis and rainfall in a tropical forest."]);

    expect(rankRetrievedChunks(query,queryEmbedding,[{
      sourceId:"source",chunkId:"irrelevant",title:"Unrelated",reference:"",sourceType:"text",relevance:0,
      text:"Photosynthesis and rainfall in a tropical forest.",embedding:irrelevantEmbedding,
    }])).toEqual([]);
  });

  it("ranks equal scores deterministically and respects final count and context bounds",async()=>{
    const provider=new DeterministicEmbeddingProvider();
    const query="TCP congestion window";
    const [queryEmbedding]=await provider.embed([query]);
    const distinctions=["bytes","acknowledgements","sequence","retransmission","timeout","roundtrip","threshold","throughput"];
    const texts=distinctions.map((detail)=>(`TCP congestion window ${detail} supporting source context `.repeat(100)).slice(0,1200));
    const candidates=texts.map((text,index)=>({
      sourceId:"source",chunkId:`chunk-${7-index}`,title:"TCP",reference:"",sourceType:"text",relevance:0,text,embedding:queryEmbedding,
    }));
    const ranked=rankRetrievedChunks(query,queryEmbedding,candidates,50);

    expect(ranked).toHaveLength(5);
    expect(new Set(ranked.map((chunk)=>chunk.relevance)).size).toBe(1);
    expect(ranked.map((chunk)=>chunk.chunkId)).toEqual(["chunk-0","chunk-1","chunk-2","chunk-3","chunk-4"]);
    expect(ranked.reduce((size,chunk)=>size+chunk.text.length,0)).toBe(5*1200);
  });
});
