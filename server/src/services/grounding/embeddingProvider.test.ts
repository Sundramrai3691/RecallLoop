import {afterEach,describe,expect,it,vi} from "vitest";
import {AppError} from "../../utils/errors.js";
import {cosineSimilarity,DeterministicEmbeddingProvider,OpenAiCompatibleEmbeddingProvider} from "./embeddingProvider.js";
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

describe("OpenAI-compatible embeddings",()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it("uses its configured endpoint and validates sorted vector dimensions",async()=>{
    const fetchMock=vi.fn(async(_url:string|URL|Request,_init?:RequestInit)=>Response.json({data:[{index:1,embedding:[0,1,2]},{index:0,embedding:[3,4,5]}]}));
    vi.stubGlobal("fetch",fetchMock);
    const provider=new OpenAiCompatibleEmbeddingProvider("https://provider.example/v1beta/openai///","gemini-embedding-001","test-key");
    const vectors=await provider.embed(["first","second"]);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://provider.example/v1beta/openai/embeddings");
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("authorization")?.startsWith("Bearer ")).toBe(true);
    expect(vectors).toEqual([[3,4,5],[0,1,2]]);
  });
  it("accepts the Gemini-compatible embedding shape when rows omit optional indexes",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>Response.json({data:[{embedding:[1,2]},{embedding:[3,4]}]})));
    const vectors=await new OpenAiCompatibleEmbeddingProvider("https://provider.example/v1","gemini-embedding-001","test-key").embed(["a","b"]);
    expect(vectors).toEqual([[1,2],[3,4]]);
  });
  it.each([[401,"EMBEDDING_AUTHENTICATION_FAILED"],[429,"EMBEDDING_RATE_LIMITED"],[503,"EMBEDDING_PROVIDER_FAILURE"]])("surfaces embedding HTTP %i clearly",async(status,code)=>{
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(null,{status:Number(status)})));
    const error=await new OpenAiCompatibleEmbeddingProvider("https://provider.example/v1","model","test-key").embed(["text"]).catch((value:unknown)=>value);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
  });
  it("rejects mixed or malformed vector dimensions",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>Response.json({data:[{index:0,embedding:[1,2]},{index:1,embedding:[3]}]})));
    const error=await new OpenAiCompatibleEmbeddingProvider("https://provider.example/v1","model","test-key").embed(["a","b"]).catch((value:unknown)=>value);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("EMBEDDING_INVALID_RESPONSE");
  });
});
