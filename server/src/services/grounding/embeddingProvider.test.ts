import {describe,expect,it} from "vitest";
import {cosineSimilarity,DeterministicEmbeddingProvider} from "./embeddingProvider.js";
import {rankRetrievedChunks} from "./groundedRemediationService.js";

describe("deterministic embeddings and retrieval ranking",()=>{
  it("returns reproducible normalized mock embeddings",async()=>{
    const provider=new DeterministicEmbeddingProvider();
    const [a,b]=await Promise.all([provider.embed(["TCP slow start congestion window"]),provider.embed(["TCP slow start congestion window"])]);
    expect(a).toEqual(b);
    expect(Math.sqrt(a[0].reduce((sum,value)=>sum+value*value,0))).toBeCloseTo(1);
    expect(cosineSimilarity(a[0],b[0])).toBeCloseTo(1);
  });
  it("ranks matching evidence first and rejects irrelevant chunks",async()=>{
    const provider=new DeterministicEmbeddingProvider();
    const query="TCP Congestion Control congestion window cwnd slow start";
    const [embedding]=await provider.embed([query]);
    const source={sourceId:"source",title:"TCP guide",reference:"https://example.test/tcp",sourceType:"text",provenance:{owner:"test"},relevance:0,chunkOrder:0};
    const ranked=rankRetrievedChunks(query,embedding,[
      {...source,chunkId:"irrelevant",text:"Photosynthesis uses light energy to build sugars in plant cells.",embedding:(await provider.embed(["Photosynthesis uses light energy to build sugars in plant cells."]))[0]},
      {...source,chunkId:"relevant",text:"TCP congestion control uses the congestion window (cwnd). Slow start increases cwnd as acknowledgements arrive.",embedding:(await provider.embed(["TCP congestion control uses the congestion window (cwnd). Slow start increases cwnd as acknowledgements arrive."]))[0]},
    ]);
    expect(ranked.map((item)=>item.chunkId)).toEqual(["relevant"]);
  });
});
