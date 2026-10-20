// Fast refusal for explicit people-evaluation requests. The system policy covers
// broader phrasing; this classifier is deliberately not a claim of complete moderation.
function safetyResponse(message){
 const people='(?:interns?|fellows?|students?|people|members?|teams?)';
 const action='(?:grad(?:e|es|ing)|rank(?:ing)?|scor(?:e|es|ing)|penaliz(?:e|ing)|penalis(?:e|ing))';
 const evaluation=new RegExp(`\\b${action}\\s+(?:(?:the|our|these|all|my|your|those)\\s+){0,3}${people}\\b|\\b${people}\\b[\\s\\S]{0,100}\\b${action}\\b`,'i');
 if(evaluation.test(message)||/\b(?:pass\s*\/\s*fail|who\s+(?:should|will|deserves?\s+to)\s+(?:pass|fail)|(?:best|worst)\s+(?:intern|fellow))\b/i.test(message))return 'I cannot grade, rank, score or penalize interns, or decide who passes or fails. I can summarize recorded deadlines, completed work and blockers, and suggest supportive next steps without judging anyone.';
 return null;
}
module.exports={safetyResponse};
