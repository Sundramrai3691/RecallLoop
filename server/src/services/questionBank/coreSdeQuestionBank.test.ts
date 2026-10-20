import { describe, expect, it } from "vitest";
import { canonicalCoreSdeQuestions, validateCoreSdeQuestionBank } from "./coreSdeQuestionBank.js";

describe("Core SDE question bank",()=>{
  it("provides stable six-candidate coverage for each authored point without duplicating prompts",()=>{
    expect(validateCoreSdeQuestionBank()).toEqual([]);
    expect(canonicalCoreSdeQuestions).toHaveLength(114);
    expect(new Set(canonicalCoreSdeQuestions.map((question)=>question.slug)).size).toBe(114);
    expect(new Set(canonicalCoreSdeQuestions.map((question)=>question.prompt.toLowerCase())).size).toBe(114);
    const points=new Set(canonicalCoreSdeQuestions.map((question)=>`${question.canonicalConceptName}\u0000${question.knowledgePoint}`));
    expect(points.size).toBe(19);
    for(const point of points){
      const group=canonicalCoreSdeQuestions.filter((question)=>`${question.canonicalConceptName}\u0000${question.knowledgePoint}`===point);
      expect(group.filter((question)=>question.questionType==="mcq")).toHaveLength(2);
      expect(group.filter((question)=>question.questionType==="rapid_recall")).toHaveLength(3);
      expect(group.filter((question)=>question.questionType==="short_explanation")).toHaveLength(1);
    }
  });

  it("keeps deterministic answer keys and source provenance on each revision candidate",()=>{
    for(const question of canonicalCoreSdeQuestions){
      expect(question.source.accessedOn).toBe("2026-10-19");
      expect(question.source.url).toMatch(/^https:\/\//);
      if(question.questionType==="mcq"){
        expect(question.options?.filter((option)=>option.id===question.correctOptionId)).toHaveLength(1);
        expect(question.distractorRationales).toHaveLength(3);
      }
    }
  });
});
